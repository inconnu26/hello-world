import React, { Component } from "react";

class Destructor extends Component {
  constructor(props) {
    super(props)
    this.state = {
        pseudo : props.name + "Ley"
    }
    
  }

  render() {
    const { name } = this.props;
    const { pseudo } = this.state;
    return (
      <div>
        <h1>My name is {name} ! and my pseudo is {pseudo}</h1>
      </div>
    );
  }
}

export default Destructor;
