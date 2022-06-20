import React, { Component } from "react";

class Welcome extends Component {
  constructor() {
    super();
    this.state = {
      message: "this is the message at first ! ",
    };
  }

  a = 0;

  changeMessage() {
    this.setState({
      message: "The text has changed !!",
    });
  }

  render() {
    return (
      <div>
        <h1>Welcome Johnny boyy ! and its message it: {this.state.message}</h1>
        <button onClick={() => this.changeMessage()}>
          button text changer !
        </button>
        {this.props.children}
      </div>
    );
  }
}

export default Welcome;
