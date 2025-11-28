'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

interface ImageProcessorProps {
  onImageProcessed?: (content: string) => void;
  onLoadComplete?: () => void;
}

// 创建一个轻量级的骨架屏组件，在ImageProcessor加载完成前显示
const ImageProcessorSkeleton = () => (
  <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700/50 backdrop-blur-md shadow-xl shadow-blue-900/10">
    <div className="h-6 w-40 bg-slate-700 rounded mb-4 animate-pulse"></div>
    <div className="h-4 w-full bg-slate-700 rounded mb-6 animate-pulse"></div>
    <div className="h-64 bg-slate-700 rounded-lg animate-pulse mb-6"></div>
    <div className="h-4 w-full bg-slate-700 rounded animate-pulse"></div>
  </div>
);

// 使用Next.js的dynamic导入实现懒加载和代码分割
const DynamicImageProcessor = dynamic(
  // 添加import的错误处理
  () => import('./ImageProcessor').then((module) => module.default).catch(error => {
    console.error('动态加载ImageProcessor组件失败:', error);
    throw error; // 继续抛出错误让React处理
  }),
  {
    ssr: false, // 禁用服务端渲染，因为ImageProcessor组件包含客户端特定功能
    loading: () => <ImageProcessorSkeleton /> // 显示加载骨架屏
  }
);

// 导出懒加载的ImageProcessor组件
export default function LazyImageProcessor(props: ImageProcessorProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // 组件加载完成后的回调
  const handleLoadComplete = () => {
    setIsLoaded(true);
  };

  return (
    <div className={isLoaded ? 'opacity-100 transition-opacity duration-300' : ''}>
      <DynamicImageProcessor 
        {...props} 
        onLoadComplete={() => {
          handleLoadComplete();
          // 如果props中有onLoadComplete，也调用它
          if (props.onLoadComplete) {
            props.onLoadComplete();
          }
        }}
      />
    </div>
  );
}