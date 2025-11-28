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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageDataUrl = e.target?.result as string;
        setSelectedImage(imageDataUrl);
        if (onLoadComplete) {
          onLoadComplete();
        }
      };
      reader.readAsDataURL(file);
    }
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
      <h2>图像处理器</h2>
      
      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        ref={fileInputRef}
        style={{ display: 'none' }}
      />
      
      <div className="relative">
        <div 
          className={`upload-area border-2 rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${selectedImage ? 'border-blue-400' : 'border-dashed border-blue-400 hover:border-blue-600 hover:bg-blue-50'}`}
          onClick={() => selectedImage ? null : fileInputRef.current?.click()}
        >
          {selectedImage ? (
            <div className="relative">
              <img 
                src={selectedImage} 
                alt="预览" 
                className="preview max-w-full h-auto max-h-[400px] mx-auto rounded-md object-contain" 
                ref={imageRef}
              />
              <button
                className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-600 transition-colors duration-200"
                onClick={() => {
                  setSelectedImage(null);
                  setAnalysisResult(null);
                }}
              >
                移除图片
              </button>
              <button
                className="absolute top-2 left-2 bg-indigo-500 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-indigo-600 transition-colors duration-200"
                onClick={() => fileInputRef.current?.click()}
              >
                替换图片
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-700 font-medium">点击或拖拽图片到此处</p>
              <p className="text-gray-500 text-sm">支持 JPG, PNG, GIF, WebP 格式</p>
              <button 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-2 rounded-full font-medium shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                选择图片文件
              </button>
            </div>
          )}
        </div>
      </div>
      
      <button 
        onClick={handleAnalyzeImage}
        disabled={!selectedImage || isAnalyzing}
        className={`mt-4 px-6 py-2 rounded-md font-medium transition-colors duration-200 shadow-sm ${selectedImage && !isAnalyzing ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
      >
        {isAnalyzing ? '分析中...' : '分析图像'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      {analysisResult && (
        <div className="analysis-result bg-gray-50 p-5 rounded-lg shadow-inner mt-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">分析结果</h3>
          
          {/* 根据分析结果内容确定样式 */}
          <p className={`mb-4 ${analysisResult.description.includes('识别到位置') ? 'text-green-700' : 
                           analysisResult.description.includes('未识别到有效地点') ? 'text-amber-700' : 
                           'text-gray-700'}`}>
            {analysisResult.description}
          </p>
          
          {analysisResult.text && analysisResult.text.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">识别标签：</h4>
              <div className="flex flex-wrap gap-2">
                {analysisResult.text.map((tag, index) => {
                  // 对荆州相关的标签添加特殊样式
                  const isJingzhouTag = tag.includes('荆州');
                  return (
                    <span 
                      key={index} 
                      className={`text-xs px-3 py-1 rounded-full ${isJingzhouTag ? 
                                'bg-red-100 text-red-800 border border-red-300' : 
                                'bg-blue-100 text-blue-800'}`}
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
            <div className="mt-4 bg-blue-50 p-3 rounded-md text-sm text-blue-700">
              <p>💡 提示：上传包含明显地标、建筑或风景的图片可以获得更准确的位置识别结果。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageProcessor;