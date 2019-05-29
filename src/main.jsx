import React from "react";

import Post from "./post.jsx";

class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: {}
    };
  }

  componentDidMount() {
    const fetchUrl = "/cms/posts"; // @TODO: should be generated or come from a config.
    fetch(fetchUrl).then(response => {
      response.json().then(parsedResults => {
        this.setState({ posts: parsedResults.reverse() });
      });
      return response;
    });
  }

  render() {
    console.log("this.state.posts: ", this.state.posts);
    return (
      <div>
        <ul>
          {this.state.posts && this.state.posts.length > 0 ? (
            this.state.posts.map(post => {
              return <Post postData={post} />;
            })
          ) : (
            <li>no posts...</li>
          )}
        </ul>
      </div>
    );
  }
}

export default Main;
