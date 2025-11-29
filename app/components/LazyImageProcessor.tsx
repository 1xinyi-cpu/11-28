'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

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
const DynamicImageProcessor = dynamic<ImageProcessorProps>(
  // 添加import的错误处理
  () => import('./ImageProcessor').then((module) => module.default).catch(error => {
    console.error('动态加载ImageProcessor组件失败:', error);
    // 返回一个错误状态的组件，而不是直接抛出错误
    return () => (
      <div className="p-6 rounded-xl bg-red-900/30 border border-red-700/50">
        <h3 className="text-red-300 font-medium mb-2">组件加载失败</h3>
        <p className="text-red-200 text-sm">无法加载图像处理组件，请刷新页面重试。</p>
      </div>
    );
  }),
  {
    ssr: false, // 禁用服务端渲染，因为ImageProcessor组件包含客户端特定功能
    loading: () => <ImageProcessorSkeleton /> // 显示加载骨架屏
  }
);

// 导出懒加载的ImageProcessor组件
export default function LazyImageProcessor(props: ImageProcessorProps) {
  // 直接移除opacity控制，让组件始终显示
  // 保留onLoadComplete回调，但不再用于控制组件的显示/隐藏

  return (
    <div className="transition-opacity duration-300">
      <DynamicImageProcessor 
        {...props} 
        // 直接传递props中的onLoadComplete
        onLoadComplete={props.onLoadComplete}
      />
    </div>
  );
}