# `buit`

> build src => lib

src(ts/tsx/js/js/less/css...) transform to lib(js/css)

support cssModules

## Usage

### install

```bash
yarn add buit
```

### build

```bash
buit build
```

will be transform `./src`->`./lib`

### build monorepo 

```bash
buit build package/a
```
will be transform `./packages/a/src` -> `./packages/a/lib`

### watch 
```
buit build -w
```
### cssModules

```bash
buit build -cp my-pkg
```
```tsx
// index.less
.container{
  background: #fff
}
// index.tsx
import styles from './index.less';

const Page: React.FC<any> = () => {
  return <div className={styles.container}>...</div>;
};
export default Page;

```

transform to =>
```jsx
// index.css
.my-pkg-container {
  color: brown;
}

// index.js
// ...
require("./index.css");

var styles = {
  "container": "my-pkg-container"
};
// ...
var Page = function Page() {
  return /*#__PURE__*/_react.default.createElement("div", {
    className: styles.container
  }, "...");
};
// ... 

```

## Options

```
Usage: buit build [options] [path]

build src dir, if assign path, will transform './{path}/src' -> './{path}/lib'

Options:
  -w, --watch                            watch change
  -t, --target                           target node or browser, default: node
  -c, --cssModules [generateScopedName]  open cssModules with generateScopedName, default: [local]__[hash]
  -cp, --cssModulesPrefix <prefix>       open cssModules and generateScopedName prefix short for [prefix]-[local]
  -h, --help                             display help for command
```