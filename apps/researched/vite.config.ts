import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ root:"frontend", plugins:[react()], resolve:{alias:{react:resolve(import.meta.dirname,"node_modules/react"),"react-dom":resolve(import.meta.dirname,"node_modules/react-dom")}}, build:{outDir:resolve(import.meta.dirname,"dist/frontend"),emptyOutDir:false} });
