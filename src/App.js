import logo from "./logo.svg";
import "./App.css";
import Greet from "./components/Greet";
import Welcome from "./components/Welcome";
import Hello from "./components/Hello";
import Counter from "./components/Counter";
import Destructor from "./components/Destructor";
import FunctionClick from "./components/FunctionClick";
import ClassClick from "./components/ClassClick";
import ParentComponent from "./components/ParentComponent";

function App() {
  return (
    <div className="App">
      {/* <Greet />
      <Welcome/> */}
      {/* <Hello name="Bruce"/> */}

      {/* <Greet name="Bruce">
        <h1>childdd</h1>
      </Greet>
      <Greet name ="John"/> */}

      {/* <Welcome>
          <h3>test child welcome!</h3>
          <h3>test child welcome!2</h3>
      </Welcome> */}
      {/* 
      <Counter /> */}

      {/* <Destructor name="Johnny1" />
      <Destructor name="Johnny2" />
      <Destructor name="Johnny3" /> */}

      <ParentComponent/>
      {/* <ClassClick/> */}

    </div>
  );
}

export default App;
