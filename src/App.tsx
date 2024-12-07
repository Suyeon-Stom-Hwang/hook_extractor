import React, { useEffect } from "react";
import "./App.css";
import HookExtractor from "./module/HookExtractor";

function App() {
  const hookExtractor = new HookExtractor();

  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const handleFileUpload = (event: Event) => {
      if (!input.files) {
        return;
      }

      const files = input.files;
      const promises = [];
      for (let i = 0; i < files.length; i++) {
        if (!files[i].webkitRelativePath.includes("node_modules") && (files[i].name.endsWith(".js") || files[i].name.endsWith(".jsx"))) {
          promises.push(
            files[i].text().then((text) => ({
              source: files[i].webkitRelativePath,
              content: text,
            }))
          );
        }
      }

      Promise.all(promises).then((results) => {
        hookExtractor.setProject(results);
        hookExtractor.print();
        console.log(hookExtractor.toJson());
      });
    };

    input.addEventListener("change", handleFileUpload);

    return () => {
      input.removeEventListener("change", handleFileUpload);
    };
  }, [inputRef]);

  return (
    <div className="App">
      <div>Hello world</div>
      <input type="file" webkitdirectory="" ref={inputRef}></input>
    </div>
  );
}

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

export default App;
