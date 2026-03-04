/// <reference types="vite/client" />

import React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  }
}

declare module "react/jsx-runtime" {
  export const jsx: typeof React.createElement;
  export const jsxs: typeof React.createElement;
  export const Fragment: typeof React.Fragment;
}
