import React from "react";

function ChildComponent(props) {
  return (
    <div>
      <button onClick={() => props.greetHandler('child !')}>Button {`Yo ! ${props.buttonName}`} !</button>
    </div>
  );
}

export default ChildComponent;
