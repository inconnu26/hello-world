import React, { Component } from "react";
import ChildComponent from "./ChildComponent";

export class ParentComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
        buttonName: "Johnny !",
        parentAlertMessage: "Message is blabla !!",
    };

    this.greetParent = this.greetParent.bind(this)

  }

  greetParent(childName){
    alert(`Message of parent: ${this.state.parentAlertMessage} from ${childName}`)
  }

  render() {
    return (
      <div>
        <ChildComponent buttonName={this.state.buttonName + "sdf"} greetHandler={this.greetParent}/>
      </div>
    );
  }
}

export default ParentComponent;
