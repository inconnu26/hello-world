import React from "react";

function Columns() {
  const items = [{id:1, title:'abc'}, {id:2, title:'def'}, {id:3, title:'ghi'}];
  return (
    <React.Fragment>
        <td>
      {items.map(item => (
        <React.Fragment key={item.id}>
          <h1>Title</h1>
          <p>{item.title}</p>
        </React.Fragment>
      ))}</td>
      <td>Name</td>
      <td>Johny</td>
    </React.Fragment>
  );
}

export default Columns;
