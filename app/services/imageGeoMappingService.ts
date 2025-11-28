/**
 * 图像特征与地理位置关联映射数据库服务
 * 用于存储和查询图像特征与地理位置之间的关系
 */

/**
 * 图像特征接口
 */
export interface ImageFeatures {
  dominantColors: Array<{ color: string; percentage: number }>;
  sceneType: string;
  objects: Array<{ name: string; confidence: number }>;
  symmetryScore?: number;
  contrast?: number;
}

/**
 * 地理位置接口
 */
export interface GeoLocation {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  category?: string;
}

/**
 * 图像特征与地理位置映射记录
 */
export interface ImageGeoMapping {
  id: string;
  imageFeatures: ImageFeatures;
  geoLocation: GeoLocation;
  confidence: number;
  timestamp: Date;
  imageId?: string;
}

/**
 * 图像地理位置映射数据库类
 * 在实际应用中，这里应该连接到真实的数据库
 * 当前实现使用内存存储作为示例
 */
export class ImageGeoMappingDatabase {
  private mappings: ImageGeoMapping[] = [];
  
  /**
   * 添加新的图像特征与地理位置映射
   */
  addMapping(imageFeatures: ImageFeatures, geoLocation: GeoLocation, confidence: number, imageId?: string): ImageGeoMapping {
    const mapping: ImageGeoMapping = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      imageFeatures,
      geoLocation,
      confidence,
      timestamp: new Date(),
      imageId
    };
    
    this.mappings.push(mapping);
    
    // 限制存储记录数量，防止内存溢出
    if (this.mappings.length > 1000) {
      this.mappings.shift(); // 删除最旧的记录
    }
    
    console.log('添加了新的图像地理映射:', mapping);
    return mapping;
  }
  
  /**
   * 基于图像特征查找最匹配的地理位置
   */
  findMatchingLocations(imageFeatures: ImageFeatures, limit: number = 5): GeoLocation[] {
    // 如果没有映射数据，返回默认位置
    if (this.mappings.length === 0) {
      return this.getDefaultLocations();
    }
    
    // 计算相似度并排序
    const scoredMappings = this.mappings.map(mapping => ({
      location: mapping.geoLocation,
      score: this.calculateFeatureSimilarity(imageFeatures, mapping.imageFeatures),
      confidence: mapping.confidence
    }));
    
    // 按综合分数排序（相似度 * 置信度）
    const sortedResults = scoredMappings
      .sort((a, b) => (b.score * b.confidence) - (a.score * a.confidence))
      .slice(0, limit);
    
    console.log('找到的匹配位置:', sortedResults);
    return sortedResults.map(result => result.location);
  }
  
  /**
   * 计算两个图像特征集之间的相似度
   */
  private calculateFeatureSimilarity(features1: ImageFeatures, features2: ImageFeatures): number {
    let similarityScore = 0;
    let weightSum = 0;
    
    // 场景类型匹配（权重：0.3）
    if (features1.sceneType && features2.sceneType) {
      similarityScore += (features1.sceneType === features2.sceneType ? 0.3 : 0);
      weightSum += 0.3;
    }
    
    // 颜色匹配（权重：0.3）
    if (features1.dominantColors && features2.dominantColors) {
      const colorSimilarity = this.calculateColorSimilarity(features1.dominantColors, features2.dominantColors);
      similarityScore += colorSimilarity * 0.3;
      weightSum += 0.3;
    }
    
    // 对象匹配（权重：0.4）
    if (features1.objects && features2.objects) {
      const objectSimilarity = this.calculateObjectSimilarity(features1.objects, features2.objects);
      similarityScore += objectSimilarity * 0.4;
      weightSum += 0.4;
    }
    
    // 返回归一化的相似度分数
    return weightSum > 0 ? similarityScore / weightSum : 0;
  }
  
  /**
   * 计算颜色相似度
   */
  private calculateColorSimilarity(colors1: Array<{ color: string; percentage: number }>, 
                                  colors2: Array<{ color: string; percentage: number }>): number {
    // 简化实现：计算两个颜色集合中最主要颜色的相似度
    if (colors1.length === 0 || colors2.length === 0) return 0;
    
    const mainColor1 = colors1[0].color;
    const mainColor2 = colors2[0].color;
    
    // 简单的颜色相似度计算（实际应用中应使用更复杂的算法如CIEDE2000）
    return mainColor1 === mainColor2 ? 1 : 0.5;
  }
  
  /**
   * 计算对象相似度
   */
  private calculateObjectSimilarity(objects1: Array<{ name: string; confidence: number }>,
                                   objects2: Array<{ name: string; confidence: number }>): number {
    if (objects1.length === 0 || objects2.length === 0) return 0;
    
    // 找出共同的对象并计算加权相似度
    let commonObjects = 0;
    let totalConfidence = 0;
    
    for (const obj1 of objects1) {
      for (const obj2 of objects2) {
        if (obj1.name === obj2.name) {
          commonObjects++;
          totalConfidence += (obj1.confidence + obj2.confidence) / 2;
          break;
        }
      }
    }
    
    return commonObjects > 0 ? totalConfidence / commonObjects : 0;
  }
  
  /**
   * 获取默认的地理位置列表
   */
  private getDefaultLocations(): GeoLocation[] {
    // 返回荆州地区的默认地标位置
    return [
      { lat: 30.3602, lng: 112.2095, name: '荆州古城墙', address: '湖北省荆州市荆州区张居正街2号', category: '历史建筑' },
      { lat: 30.3680, lng: 112.2203, name: '荆州博物馆', address: '湖北省荆州市荆州区荆中路166号', category: '文化场馆' },
      { lat: 30.3610, lng: 112.2140, name: '张居正故居', address: '湖北省荆州市荆州区张居正街', category: '历史故居' },
      { lat: 30.3500, lng: 112.2200, name: '章华寺', address: '湖北省荆州市沙市区太师渊路', category: '宗教场所' },
      { lat: 30.4200, lng: 112.1500, name: '楚王车马阵', address: '湖北省荆州市荆州区川店镇', category: '历史遗址' }
    ];
  }
  
  /**
   * 根据场景类型获取可能的地理位置
   */
  getLocationsBySceneType(sceneType: string): GeoLocation[] {
    // 根据场景类型返回可能的位置
    const typeLocationMap: { [key: string]: GeoLocation[] } = {
      '建筑': [
        { lat: 30.3602, lng: 112.2095, name: '荆州古城墙', address: '湖北省荆州市荆州区张居正街2号', category: '历史建筑' },
        { lat: 30.3680, lng: 112.2203, name: '荆州博物馆', address: '湖北省荆州市荆州区荆中路166号', category: '文化场馆' },
      ],
      '自然风景': [
        { lat: 30.3750, lng: 112.2500, name: '中山公园', address: '湖北省荆州市沙市区公园路', category: '公园' },
        { lat: 30.3500, lng: 112.1900, name: '长江边', address: '湖北省荆州市长江沿岸', category: '自然景观' }
      ],
      '室内': [
        { lat: 30.3650, lng: 112.2150, name: '荆州万达广场', address: '湖北省荆州市荆州区北京西路', category: '购物中心' },
        { lat: 30.3700, lng: 112.2200, name: '荆州站', address: '湖北省荆州市沙市区楚源大道', category: '交通枢纽' }
      ]
    };
    
    return typeLocationMap[sceneType] || this.getDefaultLocations();
  }
}

// 创建单例实例
const imageGeoDB = new ImageGeoMappingDatabase();

export default imageGeoDB;
