// CSS / CSS-module imports used by the scaffold's web build (Metro resolves
// these at runtime; this just gives TypeScript the types).
declare module "*.css";
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
