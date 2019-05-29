import React from "react";
import style from "./header.css";

class Header extends React.Component {
  render() {
    return <h1 className={style.title}>yarrumevets.com</h1>;
  }
}

export default Header;
