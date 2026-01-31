/**
 * Type declarations for ink-link
 */
declare module "ink-link" {
  import type { ReactNode } from "react";
  
  interface LinkProps {
    url: string;
    children: ReactNode;
    fallback?: boolean;
  }
  
  export default function Link(props: LinkProps): JSX.Element;
}
