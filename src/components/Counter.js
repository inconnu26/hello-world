import React, { Component } from "react";

class Counter extends Component {
  constructor(props) {
    super(props)

    this.state = {
       count : 0
    }
  }

  incrementNumber () {

    this.setState({
        count : this.state.count + 1
    })

  }

  render() {
    return (
        <div>
        <div>count is now equal to {this.state.count}</div>
        <button onClick={() => this.incrementNumber()}>Click To Increment ! </button>
        </div>
    )
  }
}

export default Counter;
