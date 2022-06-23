import React, { Component } from "react";
import RegularComponent from "../RegularComponent";
import PureComp from "./PureComp";

class ParentComp extends Component {
  constructor(props) {
    super(props);

    this.state = {
      name: "John",
    };
  }

  componentDidMount() {
    setInterval(() => {
      this.setState({
        name: "John",
      });
    }, 2000);
  }

  render() {
    console.log('****************************Parent Comp Render***************************')
    return (
      <div>
        ParentComp
        <RegularComponent name={this.state.name} />
        <PureComp name={this.state.name} />
      </div>
    );
  }
}

export default ParentComp;
