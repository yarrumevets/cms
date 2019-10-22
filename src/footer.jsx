import React from "react";
import style from "./footer.css";

class Footer extends React.Component {
  render() {
    return (
      <p>
        yarrumevets.com® <a href={"/cms/adm/admin.html"}>+</a>
      </p>
    );
  }
}

export default Footer;
