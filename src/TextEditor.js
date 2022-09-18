import React, { useCallback, useEffect, useState } from "react";
import "quill/dist/quill.snow.css";
import Quill from "quill";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";

const Save_Interval = 2000;
const Toolbar_options = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  ["clean"],
];

export default function TextEditor() {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();
  // console.log (documentId)
  // <--connect to server-->
  useEffect(() => {
    const s = io("https://cute-pear-newt-tux.cyclic.app/", {
      transports: ["polling", "websocket"],
      withCredentials: true,
    });
    setSocket(s);

    s.on("connect", () => {
      console.log(socket.id);
    });
    // <--disconnect from server-->

    return () => {
      s.disconnect(1000);
      s.on("disconnect", () => {
        console.log("disconnected");
      });
    };
  }, []);

  useEffect(() => {
    if (socket == null || quill == null) return;

    socket.once("load-document", (document) => {
      quill.setContents(document);
      quill.enable();
    });

    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  useEffect(() => {
    if (socket == null || quill == null) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, Save_Interval);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill]);

  //live changing of text at different computers
  useEffect(() => {
    if (socket == null || quill == null) return;

    const handler = (delta) => {
      quill.updateContents(delta);
    };
    socket.on("receive-changes", handler);
    return () => {
      socket.off("receive-changes", handler);
    };
  }, [socket, quill]);

  // detect the changes made by the user or not
  useEffect(() => {
    if (socket == null || quill == null) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };
    quill.on("text-change", handler);
    return () => {
      quill.off("text-change", handler);
    };
  }, [socket, quill]);

  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;
    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: Toolbar_options },
    });
    q.disable(false);
    q.setText("Loading...");
    setQuill(q);
  }, []);

  // rendering of page
  return <div className="container" ref={wrapperRef}></div>;
}
