/* Joohansson 2019 */
import React from 'react';
import { Chirp } from 'chirpsdk'
import SimpleCrypto from "simple-crypto-js";
import './Messenger.css';

class Messenger extends React.Component {
  constructor(props) {
    super(props)
    this.sdk = null
    this.state = {
      started: false,
      received: "", //received data as string
      receivedData: new Uint8Array([]), //received in Uint8Array format
      disabled: true, //send button disabled
      decryptDisabled: true, //decrypt button disabled
      downloadDisabled: true, //download button disabled
      message: "", //messeage to be sent
      payload: new Uint8Array([]),
      sendButtonTxt: "SEND 1/1", //label of send button
      nextPart: false, //if scheduler is allowed to send next part
      autoSend: true, //if send button is automatic
    }
    this.payloadChunks = [] //send payload divided into parts
    this.payloadCount = 0 //current payload
    this.payloadCountMax = 1 //maxium parts to be sent
    this.maxFileSize = 1000000 //max bytes to be dropped
    this.decryptedResult = new Uint8Array([]) //for downloads

    //Bindings
    this.handleFileSelect = this.handleFileSelect.bind(this)
    this.handleMessageChange = this.handleMessageChange.bind(this)
    this.downloadByteArray = this.downloadByteArray.bind(this)
    this.tick = this.tick.bind(this)
    this.handleAutoCheck = this.handleAutoCheck.bind(this)

    this.concatTypedArray = require('concat-typed-array');

    this.audioError = `Failed to open web audio stream.
    This may happen if your browser doesn't support Web Audio or have a mic and speaker.`
  }

  componentDidMount() {
    //Init stuff here
    if (!('WebAssembly' in window)) {
      window.alert('WebAssembly is not supported in this browser')
    }
    //Start timer for automatic sending
    else {
      this.timerID = setInterval(
      () => this.tick(),
        100
      )
    }
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  tick() {
    if (this.state.nextPart) {
      this.setState({
        nextPart: false, //disable state to disallow double sending
      }, () => {
        //After set state if finished, send next part
        if (this.payloadCount !== 0 && this.payloadCount < this.payloadChunks.length && this.state.autoSend) {
          this.sdk.send(this.payloadChunks[this.payloadCount])
        }
      })
    }
  }

  /**
  * Returns an array with arrays of the given size.
  *
  * @param myArray {Array} array to split
  * @param chunk_size {Integer} Size of every group
  */
  chunkArray(myArray, chunk_size) {
    var index = 0;
    var arrayLength = myArray.length;
    var tempArray = [];

    for (index = 0; index < arrayLength; index += chunk_size) {
      var myChunk = myArray.slice(index, index+chunk_size);
      tempArray.push(myChunk);
    }

    return tempArray;
  }

  // Show/hide how-to section
  collapse() {
    var content = document.getElementsByClassName("collapse-content")[0];
    if (content.style.maxHeight){
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  }

  //Check if all chars in a string is pure hex (not currently used but would cut the payload by 50%)
  checkIfHex(str) {
    const regexp = /^[0-9a-fA-F]+$/
    for (var i = 0; i < str.length; i++) {
      if (!regexp.test(str.charAt(i)))
        {
          return false
        }
    }
    return true
  }

  /*
  uint8ToBase64(u8) {
    var base64 = ""
    try {
      base64 = btoa(String.fromCharCode.apply(null, u8))
    }
    catch(error) {
      console.error("Bad data. Could not make base64.")
      return ""
    }
    return base64
  }
  */

  uint8ToBase64(u8Arr){
    var CHUNK_SIZE = 0x8000; //arbitrary number
    var index = 0;
    var length = u8Arr.length;
    var result = '';
    var slice;
    while (index < length) {
      slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
      result += String.fromCharCode.apply(null, slice);
      index += CHUNK_SIZE;
    }
    return btoa(result);
  }

  fromBase64(str) {
    var uint8
    try {
      uint8 = atob(str).split('').map(function (c) { return c.charCodeAt(0); })
    }
    catch(error) {
      //console.error("Bad data. Check received format.")
      return new Uint8Array([])
    }
    return new Uint8Array(uint8)
  }

  handleMessageChange(message) {
    if (message !== this.state.message) {
      this.setState({message: message})
    }

    const key = document.getElementById('psw_input').value
    const result = document.getElementById('resultTxt').value

    if (key.length > 0 && result.length > 0) {
      this.setState({ decryptDisabled: false })
    }
    else {
      this.setState({ decryptDisabled: true })
    }

    var payload = new Uint8Array(["Unknown"])
    var simpleCrypto = new SimpleCrypto(key)

    //If file imported, convert to base64 because UTF8 is not enough for non-text files
    if (this.state.payload.length > 0) {
      payload = this.state.payload
      message = this.uint8ToBase64(payload)
    }
    //Encrypt message if key is given
    if (key.length > 0 && message.length > 0) {
      message = simpleCrypto.encrypt(message)
    }

    //Valid message
    if (message.length > 0) {
      payload = new TextEncoder('utf-8').encode(message)
      this.setState({ disabled: false })

      //Divide payload into several 32 byte payloads and calculate parts needed
      this.payloadChunks = this.chunkArray(payload, 32)
      this.payloadCountMax = this.payloadChunks.length
      if (this.payloadCountMax === 0) {
        this.payloadCountMax = 1
      }
    }
    else {
      this.setState({
        disabled: true,
      })
      this.payloadCountMax = 1
    }

    this.payloadCount = 0
    this.setState({
      sendButtonTxt: "SEND "+(this.payloadCount+1)+"/"+this.payloadCountMax
    })
  }

  //When file is dropped
  handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    const scope = this

    var files = evt.dataTransfer.files; // fileList object

    var reader = new FileReader();

    reader.onload = function(theFile) {
      const data = reader.result
      var uint8 = new Uint8Array(data);
      if (uint8.length > 0) {
        scope.setState({
          payload: uint8,
          disabled: false
        }, () => {
          //After set state if finished
          scope.handleMessageChange("Loaded File: "+files[0].name)
        })
      }
    }

    //Read file (only if below max file size)
    const size = files[0].size
    if (size <= this.maxFileSize) {
      //reader.readAsBinaryString(files[0])
      reader.readAsArrayBuffer(files[0])
    }
    else {
      window.alert("Max file size allowed: 1 MB")
    }
  }

  //File drag over drop zone
  handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  //For file download link
  destroyClickedElement(event)
  {
    document.body.removeChild(event.target);
  }

  handleAutoCheck(e) {
    this.setState({
      autoSend: !this.state.autoSend,
    });
  }

  //Download a file from given filename and byteArray
  downloadByteArray() {
    var data = this.decryptedResult

    //Try decode base64 string to uint8array (if it fails, then it was not base64 ie not a file but normal text)
    let dataString = new TextDecoder('utf-8').decode(data)
    let dataTemp = this.fromBase64(dataString)
    if (dataTemp.length > 0) {
      data = dataTemp
    }

    //Try get the file type from magic numbers
    let bytes = []
    data.forEach((byte) => {
      bytes.push(byte.toString(16))
    })
    const hex = bytes.join('').toUpperCase()
    let ext = this.getMimetypeExt(hex.substring(0,8))
    let fileName = "message."+ext

    //Back to base64 encoding for file download
    var base64 = "QmFkIGRhdGEuIFRyeSB0byBjaGFuZ2UgdGhlIHJlY2VpdmUgZm9ybWF0Lg=="
    if (data.length > 0) {
      base64 = this.uint8ToBase64(data)
    }

    var downloadLink = document.createElement("a")
    downloadLink.download = fileName
    downloadLink.innerHTML = "Download File"
    if (window.webkitURL != null)
    {
        // Chrome allows the link to be clicked
        // without actually adding it to the DOM.
        //downloadLink.href = window.webkitURL.createObjectURL(blob)
        downloadLink.href = 'data:application/octet-stream;base64,' + base64
    }
    else
    {
        // Firefox requires the link to be added to the DOM
        // before it can be clicked.
        //downloadLink.href = window.URL.createObjectURL(blob)
        downloadLink.href = 'data:application/octet-stream;base64,' + base64
        downloadLink.onclick = this.destroyClickedElement
        downloadLink.style.display = "none"
        document.body.appendChild(downloadLink)
    }

    downloadLink.click();
  }

  //Guess file type
  getMimetypeExt(signature) {
    switch (signature) {
      case '89504E47':
          return 'png'
      case '47494638':
          return 'gif'
      case '25504446':
          return 'pdf'
      case 'FFD8FFDB':
      case 'FFD8FFE0':
          return 'jpg'
      case '49492A00':
          return 'tif'
      case '4D4D002A':
          return 'tif'
      case '504B0304':
          return 'zip'
      case '52617221':
          return 'rar'
      case '52494646':
          return 'wav'
      case '504D4F43':
          return 'dat'
      case '75737461':
          return 'tar'
      case '377ABCAF':
          return '7z'
      case '000001BA':
      case '000001B3':
          return 'mpg'
      default:
          return ''
    }
  }

  //Initialize the Chirp SDK
  startSDK() {
    Chirp({
      key: 'b2c2e7ed5Acebf8842C1f3F5F',
      onSending: data => {
        console.log("Sending")
        this.setState({
          disabled: true,
          sendButtonTxt: "Sending "+(this.payloadCount+1)+"/"+this.payloadCountMax+"..."
        })
      },
      onSent: data => {
        console.log("Data sent")
        //Check if there is more data to send
        this.payloadCount++
        if (this.payloadCount >= this.payloadChunks.length) {
          this.payloadCount = 0
        }

        this.setState({
          disabled: false,
          sendButtonTxt: "SEND "+(this.payloadCount+1)+"/"+this.payloadCountMax
        })

        this.setState({
          disabled: false,
          sendButtonTxt: "SEND "+(this.payloadCount+1)+"/"+this.payloadCountMax
        }, () => {
          //After set state if finished
          if (this.payloadCount < this.payloadChunks.length) {
            this.setState({
              nextPart: true
            })
          }
        })
      },
      onReceiving: () => {
        console.log("Receiving...")
        this.payloadCount = 0 //Reset any sending parts
        this.setState({
          disabled: true,
          sendButtonTxt: "Incoming..."
        })
      },
      onReceived: data => {
        console.log("Data received")
        this.setState({
          sendButtonTxt: "SEND "+(this.payloadCount+1)+"/"+this.payloadCountMax
        })
        if (data.length > 0) {
          let combinedData = this.concatTypedArray(Uint8Array,this.state.receivedData,data)
          let result = new TextDecoder('utf-8').decode(data)

          this.setState({
            receivedData: combinedData,
            received: this.state.received+result,
          })

          this.decryptedResult = combinedData //for downloads

          //Enable decrypt button
          const key = document.getElementById('psw_input').value
          if (key !== "") {
            this.setState({ decryptDisabled: false })
          }
          else {
            this.setState({ decryptDisabled: true })
          }
          this.setState({ downloadDisabled: false })
        }
        else {
          alert("Missed data. Try increase the volume.")
        }
      }
    }).then(sdk => {
      this.sdk = sdk
      this.setState({ started: true })
    }).catch(err => console.error(err) && err.message.includes('WebAssembly') ?
          window.alert(err) : window.alert(this.audioError)
        )
  }

  render() {
    return (
      <div className="App">
        <header><h1>Offline Audio Messenger</h1></header>

        {this.state.started ? (
          <div>
            <button onClick={this.collapse} className="IntroButton">HOW TO</button>
            <div className="collapse-content">
                <strong>No message data is shared but feel free to download site and use offline.<br /></strong>
                <ol>
                    <li>Message/file is sent from one device to another using speaker and microphone.</li>
                    <li>Use optional encryption to avoid anyone to intercept the audio.</li>
                    <li>If they are far apart you can use a recorder for example a phone app.</li>
                    <li>Each part is 32 chars and split automatically. Encryption is longer.</li>
                    <li>Decryption needs to be done before downloading.</li>
                </ol>
              <br />
            </div>

            {/* MESSAGE INPUT */}
            <div className="MsgBoxContainer">
              <input className="MsgBox"
                type="text"
                id="message_input"
                placeholder="Enter message"
                value={this.state.message}
                onChange={(event) => {
                  if (event.target.value.length === 0) {
                    //Reset file payload before calculating the rest
                    this.setState({
                      payload: new Uint8Array([])
                    }, () => {
                      //After set state if finished
                      this.handleMessageChange("")
                    })
                  }
                  else {
                    this.handleMessageChange(event.target.value)
                  }
                }}
              />

              {/* FILE DROPZONE */}
              <div
                id="drop_zone"
                onDragOver={this.handleDragOver}
                onDrop={this.handleFileSelect}>
                ...or drop a file here
              </div>

              {/* ENCRYPTION INPUT */}
              <input className="MsgBox"
                type="text"
                id="psw_input"
                placeholder="Encryption key (optional)"
                onChange={(event) => {
                  this.handleMessageChange(this.state.message)
                }}
              />
            </div>

            {/* AUTO TICKER */}
            <div>
              <label className="AutoSend">
                Auto Send
                <input type="checkbox"
                  checked={this.state.autoSend}
                  onChange={(event) => {
                    this.handleAutoCheck()
                  }}
                />
               </label>
            </div>

            {/* SEND BUTTON */}
            {this.state.disabled ? (
              <button id="sendButton" className="SendButton" disabled>{this.state.sendButtonTxt}</button>
              ) : (
              <button id="sendButton" className="SendButton"
                onClick={() => {
                  if (this.payloadCount === 0 || this.payloadCount >= this.payloadChunks.length) {
                    this.sdk.send(this.payloadChunks[0])
                  }
                  else {
                    this.sdk.send(this.payloadChunks[this.payloadCount])
                  }
                }}
              >{this.state.sendButtonTxt}</button>
              )
            }

            {/* RETRY BUTTON */}
            {this.state.disabled ? (
              <button id="retryButton" className="RetryButton" disabled>RETRY</button>
              ) : (
              <button id="retryButton" className="RetryButton"
                onClick={() => {
                  if (this.payloadCount > 0) {
                    this.payloadCount--
                    this.setState({
                      sendButtonTxt: "SEND "+(this.payloadCount+1)+"/"+this.payloadCountMax
                    })
                  }
                }}
              >RETRY</button>
              )
            }

            {/* RESULT AREA */}
            <div className="received-message">
              {<textarea id="resultTxt" className="Result" rows="10" value={this.state.received} placeholder="Waiting on message..." readOnly></textarea>}
            </div>

            {/* DECRYPTION BUTTON */}
            <div>
              {this.state.decryptDisabled ? (
                <button id="decryptButton" className="DecryptButton" disabled>DECRYPT</button>
                ) : (
                  <button id="decryptButton" className="DecryptButton"
                    onClick={() => {
                        //Decrypt message
                        //var result = document.getElementById("resultTxt").value
                        const key = document.getElementById('psw_input')
                        const result = new TextDecoder('utf-8').decode(this.state.receivedData)

                        var decrypted = ""
                        try {
                          var simpleCrypto = new SimpleCrypto(key.value)
                          decrypted = simpleCrypto.decrypt(result)
                        }
                        catch(error) {
                          console.error("Could not decrypt data.")
                        }

                        if (decrypted.length === 0) {
                          decrypted = "Failed to decrypt"
                        }

                        //Update the original data (if downloadings)
                        this.setState({
                          received: decrypted
                        })
                        this.decryptedResult = new TextEncoder('utf-8').encode(decrypted)
                    }
                  }
                >DECRYPT</button>
                )
              }

              {/* RESET BUTTON */}
              <button id="resetButton" className="ResetButton"
                onClick={() => {
                  //Reset textarea
                  this.setState({
                    received: "",
                    receivedData: new Uint8Array([]),
                    message: "",
                    payload: new Uint8Array([]),
                    sendButtonTxt: "SEND 1/1",
                    decryptDisabled: true,
                    downloadDisabled: true,
                  })
                  this.payloadCount = 0
                  this.payloadCountMax = 1
                  this.payloadChunks = []
                  }
                }
              >RESET</button>

              {/* DOWNLOAD BUTTON */}
              {this.state.downloadDisabled ? (
                <button id="downloadButton" className="DownloadButton" disabled>DOWNLOAD</button>
                ) : (
                  <button id="downloadButton" className="DownloadButton"
                    onClick={() => {
                      //Download the bytes shown in text textarea
                      this.downloadByteArray()
                    }
                  }
                >DOWNLOAD</button>
                )
              }
            </div>
          </div>
          ) : (
            <div className="Intro">
              <p>Send a message or file using encrypted audio. Speaker and Mic required.</p>

              <button className="StartButton"
                onClick={() => {
                  this.startSDK()
                }}
              >START</button>
            </div>
          )
        }
        <div className = "extra"></div>
        <footer className="Footer"><span>Offline version can be downloaded at </span><a href="https://github.com/Joohansson/offline-audio-messenger">Github</a></footer>
      </div>
    )
  }
}

export default Messenger;
