import React, { Component } from "react";

class Counter extends Component {
  constructor(props) {
    super(props)

    this.state = {
       count : 0
    }
  }

  incrementNumber () {

    // this.setState({
    //     count : this.state.count + 1
    // }, () => {(console.log("this.state.count = " + this.state.count))})

    this.setState( (previousState, props) => ({
      count : previousState.count + 1
    }), () => {(console.log("this.state.count = " + this.state.count))}
    )

  }

  incrementByFive() {

    this.incrementNumber()
    this.incrementNumber()
    this.incrementNumber()
    this.incrementNumber()
    this.incrementNumber()

  }



  render() {
    return (
        <div>
        <div>count is now equal to {this.state.count}</div>
        <button onClick={() => this.incrementByFive()}>Click To Increment ! </button>
        </div>
    )
  }
}

export default Counter;
