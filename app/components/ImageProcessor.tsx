'use client';

import React, { useState, useRef } from 'react';
import { analyzeImageWithMapAPIs } from '../services/mapApiService';

interface ImageProcessorProps {
  onImageProcessed?: (content: string) => void;
  onLoadComplete?: () => void;
}

interface KeywordItem {
  keyword: string;
  score?: number;
}

interface AnalysisResult {
  description: string;
  text?: string[];
}

// 注意：百度API的密钥和处理函数现已移至API路由(/api/analyze-image)中实现
// 这样可以避免在前端暴露密钥，并解决CORS问题

const analyzeImageContent = async (imageDataUrl: string): Promise<AnalysisResult> => {
  try {
    console.log('[DEBUG] 开始分析图像，调用百度地图API...');
    
    // 将DataURL转换为File对象以适配mapApiService
    const blob = await (await fetch(imageDataUrl)).blob();
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
    
    // 直接调用百度地图API进行图像分析
    const result = await analyzeImageWithMapAPIs(file);
    console.log('[DEBUG] 百度地图API分析结果:', JSON.stringify(result, null, 2));
    
    // 处理分析结果，构建描述文本
    let description = '图像分析完成';
    const keywords: string[] = [];
    
    // 从API结果中提取关键信息
    if (result.location && result.location.name) {
      // 优化置信度描述
      let confidenceText = '';
      if (result.location.confidence >= 0.7) {
        confidenceText = '（高置信度）';
      } else if (result.location.confidence >= 0.5) {
        confidenceText = '（中等置信度）';
      } else if (result.location.confidence >= 0.3) {
        confidenceText = '（低置信度）';
      } else {
        confidenceText = '（极低置信度）';
      }
      
      // 判断是否为荆州地区的特殊处理
      if (result.isJingzhouArea) {
        description = `识别到位置: ${result.location.name}（荆州地区${confidenceText}）`;
      } else {
        description = `识别到位置: ${result.location.name}${confidenceText}`;
      }
      
      keywords.push(result.location.name);
      
      // 添加地址信息（如果有）
      if (result.location.address && result.location.address !== '无法确定') {
        description += `，地址: ${result.location.address}`;
      }
    }
    
    // 优化地标信息展示
    if (result.landmarks && result.landmarks.length > 0) {
      // 按置信度排序
      const sortedLandmarks = [...result.landmarks].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      
      // 构建地标信息文本
      const landmarkTexts = sortedLandmarks.slice(0, 3).map(landmark => {
        let confidenceMark = '';
        if (landmark.confidence >= 0.7) {
          confidenceMark = '★';
        } else if (landmark.confidence >= 0.5) {
          confidenceMark = '☆';
        }
        return `${landmark.name}${confidenceMark}`;
      });
      
      if (landmarkTexts.length > 0) {
        description += `，识别到的地标: ${landmarkTexts.join('、')}`;
        keywords.push(...sortedLandmarks.slice(0, 3).map(landmark => landmark.name));
      }
    }
    
    // 增强区域信息展示
    if (result.region) {
      description += `，位于${result.region}`;
      keywords.push(result.region);
      
      // 如果是荆州地区，添加特殊标记
      if (result.isJingzhouArea && !description.includes('荆州地区')) {
        description += '（荆州地区）';
      }
    }
    
    // 添加额外的分析内容
    const additionalInfo: string[] = [];
    
    // 地标数量信息
    if (result.landmarks && result.landmarks.length > 0) {
      additionalInfo.push(`共识别到${result.landmarks.length}个地标`);
    }
    
    // 建筑物信息
    if (result.buildings && result.buildings.length > 0) {
      additionalInfo.push(`识别到${result.buildings.length}栋建筑物`);
      keywords.push(...result.buildings.slice(0, 2).map(building => building.name || '建筑物'));
    }
    
    // 添加额外信息
    if (additionalInfo.length > 0) {
      description += `。${additionalInfo.join('，')}`;
    }
    
    // 确保返回有效的结果
    if (!result.location || (!result.location.name || result.location.name === '未知位置')) {
      description = '未识别到有效地点，但系统已分析图像特征';
      if (result.region && result.region !== '未知区域') {
        description += `，位于${result.region}`;
        keywords.push(result.region);
      }
    }
    
    console.log('[DEBUG] 生成的分析描述:', description);
    console.log('[DEBUG] 提取的关键词:', keywords);
    
    return {
      description,
      text: keywords
    };
  } catch (error) {
    console.error('[DEBUG] 图像分析失败:', error);
    // 失败时返回友好的错误描述
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    // 避免显示技术错误信息给用户
    let userFriendlyMessage = '图像分析过程中遇到问题';
    if (errorMessage.includes('未识别到有效地点')) {
      userFriendlyMessage = '未能从图像中识别出明确的地理位置信息，请尝试上传包含明显地标或特征的图片';
    }
    
    return {
      description: userFriendlyMessage,
      text: []
    };
  }
};

const ImageProcessor: React.FC<ImageProcessorProps> = ({ onImageProcessed, onLoadComplete }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processImageFile(file);
  };

  const processImageFile = (file: File | null | undefined) => {
    if (!file) return;
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传有效的图片文件');
      return;
    }
    
    // 验证文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过5MB');
      return;
    }
    
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target?.result as string;
      setSelectedImage(imageDataUrl);
      if (onLoadComplete) {
        onLoadComplete();
      }
    };
    reader.onerror = () => {
      setError('图片读取失败');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    processImageFile(file);
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('开始图像分析...');
      const result = await analyzeImageContent(selectedImage);
      setAnalysisResult(result);
      
      if (onImageProcessed) {
        onImageProcessed(result.description || '图像分析完成');
      }
    } catch (err) {
      console.error('图像分析失败:', err);
      // 在UI上显示错误信息
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setAnalysisResult({
        description: `图像分析失败: ${errorMsg}`
      });
      setError(`图像分析失败: ${errorMsg}`);
    } finally {
      setIsAnalyzing(false);
      console.log('分析完成');
    }
  };

  return (
    <div className="image-processor">
      <h2 className="text-xl font-semibold mb-4 text-white">图像处理器</h2>
      
      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        ref={fileInputRef}
        style={{ display: 'none' }}
      />
      
      <div className="relative">
        {/* 优化后的上传区域 */}
        <div 
          className={`upload-area border-2 rounded-lg p-8 text-center cursor-pointer transition-all duration-300 min-h-[280px] flex flex-col items-center justify-center backdrop-blur-sm
            ${selectedImage ? 'border-green-500 bg-green-900/20' : 
              isDragging ? 'border-blue-400 bg-blue-900/30 shadow-lg scale-105' : 
              'border-dashed border-slate-500 hover:border-blue-400 hover:bg-blue-900/10 hover:shadow-md'}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          ref={uploadAreaRef}
        >
          {/* 无论是否选择了图片，都显示上传提示区域 */}
          <div className="flex flex-col items-center justify-center space-y-3 w-full">
            {selectedImage ? (
              <div className="relative w-full max-w-md mx-auto mb-6">
                {/* 预览图片容器 - 确保图片在框内完整显示 */}
                <div className="relative bg-black/30 rounded-lg overflow-hidden shadow-xl p-2 transition-all duration-500 animate-fade-in">
                  <img 
                    src={selectedImage} 
                    alt="上传图片预览" 
                    className="preview w-full h-auto max-h-[180px] mx-auto rounded-md object-contain transition-all duration-300 hover:scale-[1.02]" 
                    ref={imageRef}
                  />
                  
                  {/* 图片信息标签 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent py-3 px-4">
                    <p className="text-white text-sm font-medium">图片已上传</p>
                  </div>
                  
                  {/* 操作按钮容器 */}
                  <div className="absolute top-2 right-2 flex space-x-2">
                    <button
                      className="bg-red-500/90 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-600 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(null);
                        setAnalysisResult(null);
                      }}
                      aria-label="移除图片"
                    >
                      ✕ 移除
                    </button>
                  </div>
                  
                  {/* 底部操作按钮 */}
                  <div className="absolute bottom-2 left-2">
                    <button
                      className="bg-indigo-500/90 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-600 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      aria-label="替换图片"
                    >
                      ↻ 替换
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            
            {/* 上传图标使用动态颜色 */}
            <div className="text-5xl mb-4 animate-pulse">
              {isDragging ? '📁' : '📷'}
            </div>
            
            {/* 主标题使用更醒目的字体 */}
            <h3 className="text-xl font-bold text-white mb-2 transition-colors duration-300">
              {selectedImage ? '已选择图片 - 点击可更换' : (isDragging ? '释放以上传图片' : '点击或拖拽图片到此处')}
            </h3>
            
            {/* 支持格式说明 */}
            <p className="text-sm text-slate-300 mb-4">
              支持 JPG, PNG, WebP 格式，最大5MB
            </p>
            
            {/* 按钮样式优化 */}
            <button 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-2.5 rounded-full font-medium shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              {selectedImage ? '更换图片' : '选择图片'}
            </button>
          </div>
        </div>
      </div>
      
      <button 
        onClick={handleAnalyzeImage}
        disabled={!selectedImage || isAnalyzing}
        className={`mt-4 px-6 py-2 rounded-md font-medium transition-colors duration-200 shadow-sm ${selectedImage && !isAnalyzing ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}
      >
        {isAnalyzing ? '分析中...' : '分析图像'}
      </button>
      
      {error && <div className="error mt-3 text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</div>}
      
      {analysisResult && (
        <div className="analysis-result bg-slate-700/40 p-5 rounded-lg shadow-inner mt-4 border border-slate-600/50">
          <h3 className="text-lg font-semibold mb-3 text-white">分析结果</h3>
          
          {/* 根据分析结果内容确定样式 */}
          <p className={`mb-4 ${analysisResult.description.includes('识别到位置') ? 'text-green-400' : 
                           analysisResult.description.includes('未识别到有效地点') ? 'text-amber-400' : 
                           'text-slate-300'}`}>
            {analysisResult.description}
          </p>
          
          {analysisResult.text && analysisResult.text.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">识别标签：</h4>
              <div className="flex flex-wrap gap-2">
                {analysisResult.text.map((tag, index) => {
                  // 对荆州相关的标签添加特殊样式
                  const isJingzhouTag = tag.includes('荆州');
                  return (
                    <span 
                      key={index} 
                      className={`text-xs px-3 py-1 rounded-full ${isJingzhouTag ? 
                                'bg-red-900/30 text-red-300 border border-red-700/30' : 
                                'bg-blue-900/30 text-blue-300 border border-blue-700/30'}`}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* 添加帮助信息 */}
          {analysisResult.description.includes('未识别到有效地点') && (
            <div className="mt-4 bg-blue-900/20 p-3 rounded-md text-sm text-blue-300 border border-blue-700/30">
              <p>💡 提示：上传包含明显地标、建筑或风景的图片可以获得更准确的位置识别结果。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageProcessor;