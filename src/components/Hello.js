import React from "react";

const Hello = () => {
  // return (
  //     <div>
  //         <h1>
  //             Hello Johnnyy boyy 2 !
  //         </h1>
  //     </div>
  // )
  return React.createElement(
    "div",
    { id: "hello", className: "dummyClass" },
    React.createElement("h1", null, "Hello Joohhnny boy 3 ??")
  );
};

export default Hello;
