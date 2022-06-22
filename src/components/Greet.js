import React from "react";

// function Greet(){
//     return <h1>Hello Jonathan !</h1>
// }

const Greet = (props) => {
  const {name} = props
  console.log(name);
  return (
    <div>
      <h1>Hello {name} !</h1>
      
    </div>
  );
};

export default Greet;
