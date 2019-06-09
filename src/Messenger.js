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
      received: "",
      receivedData: new Uint8Array([]), //received in Uint8Array format
      disabled: true,
      decryptDisabled: true,
      resultType: "ascii"
    }
    this.payloadChunks = null
    this.payloadCount = 0
    this.sendButtonTxt = "SEND PART 1"
    this.shouldReset = true

    //Bindings
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);

    this.concatTypedArray = require('concat-typed-array');
  }

  toAscii(payload) {
    let str = ''
    for (let i = 0; i < payload.length; i++) {
      str += String.fromCharCode(payload[i])
    }
    return str
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

  // Show/hide how to section
  collapse() {
    var content = document.getElementsByClassName("collapse-content")[0];
    if (content.style.maxHeight){
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  }

  //Check if a string is pure hex
  checkIfHex(inputString) {
    var re = /[0-9A-Fa-f]{6}/g;

    if(re.test(inputString)) {
      re.lastIndex = 0;
      return true
    } else {
      re.lastIndex = 0;
      return false
    }
  }

  //Handle radio button change
  handleChange(event) {
    this.setState({
      resultType: event.target.value
    });

    var result = ""
    const data = this.state.receivedData
    //Message is ascii encoded
    if (event.target.value === "ascii") {
      result = this.toAscii(data)

    }
    //Message is hex encoded
    else if (event.target.value === "hex") {
      console.log("Data:"+data)
      const toHexString = data =>
      data.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
      result = toHexString(data)
    }
    this.setState({
      received: result
    })
  }

  //Disable default radio button behaviour
  handleSubmit(event) {
    event.preventDefault();
  }

  async startSDK() {
    this.sdk = await Chirp({
      key: 'b2c2e7ed5Acebf8842C1f3F5F',
      onSending: data => {
        console.log("Sending")
        this.sendButtonTxt = "Sending..."
        this.setState({ disabled: true })
      },
      onSent: data => {
        console.log("Data sent")
        //Check if there is more data to send
        this.payloadCount++
        if (this.payloadCount >= this.payloadChunks.length) {
          //this.sendPayload(this.payloadChunks[this.payloadCount])
          //document.getElementById("sendButton").click();
          this.payloadCount = 0
        }
        this.sendButtonTxt = "SEND PART "+this.payloadCount+1
        this.setState({ disabled: false })
      },
      onReceiving: () => {
        this.sendButtonTxt = "Incoming..."
        this.payloadCount = 0 //Reset any sending parts
        this.setState({
          //received: 'listening...',
          disabled: true
        })
      },
      onReceived: data => {
        this.sendButtonTxt = "SEND PART 1"
        if (data.length > 0) {
          var result = ""

          //Message is ascii encoded
          if (this.state.resultType === "ascii") {
            result = this.toAscii(data)
          }
          //Message is hex encoded
          else if (this.state.resultType === "hex") {
            const toHexString = data =>
            data.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
            result = toHexString(data)
          }
          console.log("Data:"+data)
          console.log("Ascii data: "+this.toAscii(data))
          console.log("Hex data: "+result)

          if (this.shouldReset) {
            //Reset textarea
            this.setState({
              received: "",
              receivedData: new Uint8Array([]),
            })
            this.shouldReset = false
          }

          this.setState({
            //receivedData: this.state.receivedData.concat(data), //Save raw data (append to existing array)
            receivedData: this.concatTypedArray(Uint8Array,this.state.receivedData,data),
            received: this.state.received+result,
            disabled: false,
          })

          //Enable decrypt button
          const key = document.getElementById('psw_input').value
          if (key !== "") {
            this.setState({ decryptDisabled: false })
          }
          else {
            this.setState({ decryptDisabled: true })
          }

        } else {
          this.setState({
            received: `I didn't hear that. Try turning the volume up?`,
            disabled: false
          })
          this.shouldReset = true
        }
      }
    })
    this.setState({ started: true })
  }

  render() {
    return (
      <div className="App">
        <header><h1>Offline Audio Messenger</h1></header>

        {this.state.started ? (
          <div>
            <button onClick={this.collapse} className="IntroButton">How to use</button>
            <div className="collapse-content">
                <strong>No message data is shared but feel free to download site and use offline.<br /></strong>
                <ol>
                    <li>Send message from one device to another using speaker and microphone.</li>
                    <li>If they are far apart you can use a recorder for example a phone app.</li>
                    <li>Use optional encryption to avoid anyone to intercept the audio.</li>
                    <li>Each (non encrypted) part is 32 chars (or 64 if hex) and split automatically.</li>
                    <li>Use same encryption key on the receiving end.</li>
                </ol>
              <br />
            </div>

            <div className="MsgBoxContainer">
              <input className="MsgBox"
                type="text"
                id="message_input"
                placeholder="Enter message"
                onChange={() => {
                  const msg = document.getElementById('message_input').value
                  if (msg !== "") {
                    this.setState({ disabled: false })
                  }
                  else {
                    this.setState({ disabled: true })
                  }
                }}
              />

              <input className="MsgBox"
                type="text"
                id="psw_input"
                placeholder="Encryption key (optional)"
                onChange={() => {
                  const key = document.getElementById('psw_input').value
                  const result = document.getElementById('resultTxt').value
                  if (key !== "" && result !== "") {
                    this.setState({ decryptDisabled: false })
                  }
                  else {
                    this.setState({ decryptDisabled: true })
                  }
                }}
              />
            </div>

            {this.state.disabled ? (
              <button id="sendButton" className="SendButton" disabled>{this.sendButtonTxt}</button>
              ) : (
              <button id="sendButton" className="SendButton"
                onClick={() => {
                  if (this.payloadCount === 0 || this.payloadCount >= this.payloadChunks.length) {
                    const input = document.getElementById('message_input').value
                    const key = document.getElementById('psw_input').value
                    var message = input
                    var payload = []
                    //Encrypt message if key is given
                    if (key !== "") {
                      var simpleCrypto = new SimpleCrypto(key)
                      message = simpleCrypto.encrypt(input)
                    }
                    //If not encrypting, check if hex because it will reduce the byte length by half
                    else {
                      if (this.checkIfHex(message)) {
                        //Convert hexstring to byteArray
                        const fromHexString = message =>
                        new Uint8Array(input.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                        payload = fromHexString(message)
                        console.log(payload)
                      }
                      else {
                        payload = new TextEncoder('utf-8').encode(message)
                      }
                    }

                    //Divide payload into several 32 byte payloads
                    this.payloadChunks = this.chunkArray(payload, 32)

                    this.sdk.send(this.payloadChunks[0])
                  }
                  else {
                    this.sdk.send(this.payloadChunks[this.payloadCount])
                  }
                }}
              >SEND PART {this.payloadCount+1}</button>
              )
            }

            <div className="received-message">
              {<textarea id="resultTxt" className="Result" rows="10" value={this.state.received} placeholder="Waiting on message..." readOnly></textarea>}
            </div>

            <div className="ResultType">
              <label>
                <input
                  type="radio"
                  value="ascii"
                  checked={this.state.resultType === "ascii"}
                  onChange={this.handleChange}
                />
                Ascii
              </label>
              <label>
                <input
                  type="radio"
                  value="hex"
                  checked={this.state.resultType === "hex"}
                  onChange={this.handleChange}
                />
                Hex
              </label>
            </div>

            {this.state.decryptDisabled ? (
              <button id="decryptButton" className="DecryptButton" disabled>DECRYPT</button>
              ) : (
                <button id="decryptButton" className="DecryptButton"
                  onClick={() => {
                      //Decrypt message
                      var result = document.getElementById("resultTxt").value
                      console.log(result)
                      const key = document.getElementById('psw_input')
                      var simpleCrypto = new SimpleCrypto(key.value)
                      var decrypted = simpleCrypto.decrypt(result)
                      console.log(decrypted)
                      document.getElementById("resultTxt").value = decrypted
                    }
                  }
                >DECRYPT</button>
              )
            }

            <button id="resetButton" className="ResetButton"
              onClick={() => {
                //Reset textarea
                this.setState({
                  received: "",
                  receivedData: new Uint8Array([]),
                })
                }
              }
            >RESET</button>

          </div>
          ) : (
            <button className="SendButton"
              onClick={() => {
                this.startSDK()
              }}
            >START</button>
          )
        }
        <footer className="Footer"><span>Offline version can be downloaded at </span><a href="https://github.com">Github</a></footer>
      </div>
    )
  }
}

export default Messenger;
