import React from 'react';
import less from './index.less';
import scss from './index.scss';
import './normal.less';

const Page: React.FC<any> = () => {
  return (
    <div className={less.container}>
      <div className={scss.content}></div>
    </div>
  );
};

export default Page;
