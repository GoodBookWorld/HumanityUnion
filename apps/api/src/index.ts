import app from "./app.js";
import { environment } from "./config/environment.js";

app.listen(environment.apiPort, () => {
  console.log(
    `Humanity Union API is running at http://localhost:${environment.apiPort}/api/v1/health`,
  );
});
