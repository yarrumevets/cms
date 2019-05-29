import React from "react";
import style from "./post.css";
import moment from "moment";

class Post extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: {}
    };
  }

  render() {
    const post = this.props.postData;
    console.log("post: ", post);
    return (
      <li className={style.postWrapper}>
        <h2 className={style.postCaption}>{post.postCaption}</h2>
        <img className={style.postImage} src={post.imageUrl} />
        <p className={style.postImageCaption}>{post.imageCaption}</p>
        <p className={style.postBody}>{post.postBody}</p>
        <p className={style.postDate}>
          Posted on {moment(post.postDate).format("MMMM Do YYYY, h:mm:ss a")}
        </p>
      </li>
    );
  }
}

export default Post;
