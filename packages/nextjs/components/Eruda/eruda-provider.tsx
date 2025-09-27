"use client";

import { ReactNode, useEffect } from "react";
import eruda from "eruda";

export const Eruda = (props: { children: ReactNode }) => {
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        eruda.init();
      } catch (error) {
        console.log("Eruda failed to initialize", error);
      }
    }
  }, []);

  return <>{props.children}</>;
};
