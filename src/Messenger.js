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
      disabled: true,
      decryptDisabled: true
    }
    this.payloadChunks = null
    this.payloadCount = 0
    this.sendButtonTxt = "SEND PART 1"
    this.shouldReset = true
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

  sleep(ms) {
      var unixtime_ms = new Date().getTime();
      while(new Date().getTime() < unixtime_ms + ms) {}
  }

  sendPayload(payload) {
    this.sdk.send(payload)
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
          console.log("Got data: "+this.toAscii(data))
          if (this.shouldReset) {
            //Reset textarea
            this.setState({
              received: "",
            })
            this.shouldReset = false
          }
          this.setState({
            received: this.state.received+this.toAscii(data),
            disabled: false
          })
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
  /*
  startSDK () {
    Chirp({
      key: 'b2c2e7ed5Acebf8842C1f3F5F',
      onSending: data => {
        console.log("Sending")
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
          console.log("Do again")
        }
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
          console.log("Got data: "+this.toAscii(data))
          if (this.shouldReset) {
            //Reset textarea
            this.setState({
              received: "",
            })
            this.shouldReset = false
          }
          this.setState({
            received: this.state.received+this.toAscii(data),
            disabled: false
          })
        } else {
          this.setState({
            received: `I didn't hear that. Try turning the volume up?`,
            disabled: false
          })
          this.shouldReset = true
        }
      }}).then(sdk => {
      this.sdk = sdk
      this.setState({ started: true })
    }).catch(console.error)

  */

  render() {
    return (
      <div className="App">
        <header><h1>Offline Audio Messenger</h1></header>

        {this.state.started ? (
          <div>
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
                  if (key !== "") {
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

                    //Encrypt message if key is given
                    if (key !== "") {
                      var simpleCrypto = new SimpleCrypto(key)
                      message = simpleCrypto.encrypt(input)
                    }

                    var payload = new TextEncoder('utf-8').encode(message)

                    //Divide payload into several 32 byte payloads
                    this.payloadChunks = this.chunkArray(payload, 32)
                    //var hexString = "0FEF14EFB509DF3AAABB37C68413AA8DD4811C39E05287F1289ED8D9843FCFED"
                    //const fromHexString = hexString =>
                    //new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                    //const payload = fromHexString(hexString)
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
