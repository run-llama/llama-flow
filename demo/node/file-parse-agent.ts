import { promiseHandler } from "fluere/interrupter/promise";
import { fileParseWorkflow } from "../workflows/file-parse-agent";

const directory = "..";

promiseHandler(() => fileParseWorkflow.run(directory)).then(({ data }) => {
  console.log(data);
});
