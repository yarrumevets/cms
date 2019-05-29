import React from "react";
import ReactDOM from "react-dom";
import style from "./index.css";
import Header from "./header.jsx";
import Main from "./main.jsx";
import Footer from "./footer.jsx";

const Index = () => {
  return (
    <div>
      <Header />
      <Main />
      <Footer />
    </div>
  );
};

ReactDOM.render(<Index />, document.getElementById("index-dot-html"));
