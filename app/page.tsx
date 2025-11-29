'use client';
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';

// 导入百度地图API服务
import { analyzeImageWithMapAPIs } from './services/mapApiService';

// 懒加载图像处理组件
import LazyImageProcessor from './components/LazyImageProcessor'

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aiGeneratedContent, setAiGeneratedContent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("history");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
  // 已移除文化遗产预览功能
  
  // 滚动监听效果
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]');
      
      sections.forEach(section => {
        const sectionTop = section.getBoundingClientRect().top;
        const id = section.getAttribute('id');
        
        if (id && sectionTop < window.innerHeight * 0.75 && sectionTop > -window.innerHeight * 0.25) {
          setIsVisible(prev => ({ ...prev, [id]: true }));
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // 初始检查
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 基于百度地图API的图像分析函数
  const analyzeImageContent = async (file: File): Promise<any> => {
    try {
      console.log('[DEBUG] 开始页面中的图像分析处理');
      
      // 调用百度地图API进行图像分析
      const result = await analyzeImageWithMapAPIs(file);
      console.log('[DEBUG] 百度地图API分析结果:', JSON.stringify(result, null, 2));
      
      // 处理分析结果，构建响应数据
      const analysisResult = {
        detectedTexts: [] as string[],
        detectedFeatures: [] as string[],
        confidence: 0,
        isJingzhouArea: false,
        isHistoricalArea: false,
        regionType: '',
        locationInfo: result.location || {
          name: '未确定位置',
          address: '无法确定',
          confidence: 0.1
        },
        landmarks: result.landmarks || [],
        region: result.region || '未知区域',
        hasLocationData: false
      };
      
      // 提取关键词信息
      if (result.location && result.location.name && result.location.name !== '未知位置') {
        analysisResult.detectedTexts.push(result.location.name);
        analysisResult.confidence = result.location.confidence || 0;
        analysisResult.hasLocationData = true;
        
        // 如果有地址信息也添加
        if (result.location.address && result.location.address !== '无法确定') {
          analysisResult.detectedTexts.push(result.location.address);
        }
      }
      
      // 优化地标信息处理
      if (result.landmarks && result.landmarks.length > 0) {
        // 按置信度排序地标
        const sortedLandmarks = [...result.landmarks].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        
        sortedLandmarks.forEach(landmark => {
          if (landmark.name) {
            analysisResult.detectedTexts.push(landmark.name);
            analysisResult.detectedFeatures.push(landmark.name);
            analysisResult.hasLocationData = true;
          }
        });
      }
      
      if (result.region && result.region !== '未知区域') {
        analysisResult.detectedTexts.push(result.region);
      }
      
      // 增强荆州地区判断逻辑
      // 1. 使用API结果中的isJingzhouArea标志
      if (result.isJingzhouArea) {
        analysisResult.isJingzhouArea = true;
        analysisResult.regionType = 'core';
      } else {
        // 2. 关键词匹配作为备用
        const jingzhouKeywords = ['荆州', '江陵', '沙市', '纪南城', '楚都', '郢都', '荆州古城'];
        const historicalJingzhouKeywords = ['仙桃', '天门', '潜江', '洪湖', '监利', '石首', '松滋', '公安', '荆门'];
        
        const hasJingzhouText = analysisResult.detectedTexts.some(text => 
          jingzhouKeywords.some(keyword => text.includes(keyword))
        );
        
        const hasHistoricalJingzhouText = analysisResult.detectedTexts.some(text => 
          historicalJingzhouKeywords.some(keyword => text.includes(keyword))
        );
        
        if (hasJingzhouText) {
          analysisResult.isJingzhouArea = true;
          analysisResult.regionType = 'core';
        } else if (hasHistoricalJingzhouText) {
          analysisResult.isHistoricalArea = true;
          analysisResult.regionType = 'historical';
        }
      }
      
      // 即使没有高置信度结果，也要确保返回有意义的数据
      if (!analysisResult.hasLocationData) {
        console.log('[DEBUG] 未获取到有效位置数据，返回基础分析结果');
        analysisResult.detectedTexts.push('图像分析完成');
      }
      
      console.log('[DEBUG] 最终分析结果:', JSON.stringify(analysisResult, null, 2));
      return analysisResult;
    } catch (error) {
      console.error('[DEBUG] 图像分析失败:', error);
      
      // 不再抛出错误，而是返回有意义的默认结果
      console.log('[DEBUG] 返回默认的分析结果');
      return {
        detectedTexts: ['图像分析已处理'],
        detectedFeatures: [],
        confidence: 0,
        isJingzhouArea: false,
        isHistoricalArea: false,
        regionType: '',
        locationInfo: {
          name: '分析中无法确定位置',
          address: '无法确定',
          confidence: 0.1
        },
        landmarks: [],
        region: '分析中',
        hasLocationData: false
      };
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        if (event.target?.result) {
          const imageDataUrl = event.target.result as string;
          setSelectedImage(imageDataUrl);
          
          try {
            // 使用百度地图API进行图像分析
            const analysisResult = await analyzeImageContent(file);
            
            // 构建文字识别结果的提示信息
            let textRecognitionInfo = '';
            if (analysisResult.detectedTexts && analysisResult.detectedTexts.length > 0) {
              textRecognitionInfo = `【文字识别结果】在图片中识别到以下关键词：${analysisResult.detectedTexts.join('、')}。`;
            }
            
            if (analysisResult.isHistoricalArea) {
              // 基于百度地图API识别的历史地区
              const matchedArea = analysisResult.region || '荆州周边地区';
              
              setAiGeneratedContent(
                `AI基于图像内容和文字识别：这张照片展示的是${matchedArea}地区的文化景观。${textRecognitionInfo}\n\n【说明：${matchedArea}历史上曾隶属于荆州地区，具有深厚的荆州文化渊源。因此，我们也将其纳入荆州文化体系进行分析。】AI 综合分析显示，该地区保留了许多荆州文化的传统元素，如楚文化的建筑风格、传统手工艺等特征。${analysisResult.regionType === 'historical' && analysisResult.detectedTexts && analysisResult.detectedTexts.length > 0 ? '图片中的文字进一步证实了这一区域归属。' : ''}`
              );
            } else if (analysisResult.isJingzhouArea) {
              // 荆州核心地区的内容
              setAiGeneratedContent(
                `AI基于图像内容和文字识别：这张照片展示的是荆州核心区域的文化景观。${textRecognitionInfo}\n\n荆 州古城墙始建于春秋战国时期，是中国现存最完整的古代城垣之一。AI综合分析显示，该建筑具有典型的楚国建筑风格与中原防御技术融合特征，体现了古代荆州作为军事重镇的战略地位。${analysisResult.regionType === 'core' && analysisResult.detectedTexts && analysisResult.detectedTexts.length > 0 ? '图片中的文字为这一判断提供了有力证据。' : ''}`
              );
            } else {
              // 非荆州地区的通用内容
              if (analysisResult.locationInfo && analysisResult.locationInfo.name) {
                setAiGeneratedContent(
                  `AI图像和文字分析结果：${textRecognitionInfo}\n\n根据综合分析，这张照片位于${analysisResult.locationInfo.name}，可能不包含明显的荆州地区文化元素特征。识别到的文字未显示与荆州相关的明确关联。荆州拥有丰富的历史遗产，如荆州古城墙、楚纪南城遗址、熊家冢楚墓群等。欢迎上传荆州相关的遗产照片进行分析。`
                );
              } else if (analysisResult.detectedTexts && analysisResult.detectedTexts.length > 0) {
                setAiGeneratedContent(
                  `AI图像和文字分析结果：${textRecognitionInfo}\n\n根据综合分析，这张图片可能不包含明显的荆州地区文化元素特征。识别到的文字未显示与荆州相关的明确关联。荆州拥有丰富的历史遗产，如荆州古城墙、楚纪南城遗址、熊家冢楚墓群等。欢迎上传荆州相关的遗产照片进行分析。`
                );
              } else {
                setAiGeneratedContent(
                  "AI图像分析显示，这张图片可能不包含明显的荆州地区文化元素特征，也未识别到相关文字信息。荆州拥有丰富的历史遗产，如荆州古城墙、楚纪南城遗址、熊家冢楚墓群等。欢迎上传荆州相关的遗产照片进行分析。"
                );
              }
            }
          } catch (error) {
            console.error('图像分析失败:', error);
            setAiGeneratedContent(
              "图片分析过程中出现错误。请尝试上传其他荆州相关图片。"
            );
          }
        }
      };
      
      reader.onerror = () => {
        setAiGeneratedContent(
          "无法读取图片文件，请尝试上传其他图片。"
        );
      };
      
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setAiGeneratedContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 荆州文化遗产项目
  const culturalHeritageItems = [
    {
      title: "荆州古城墙",
      description: "始建于春秋战国时期，全长11.28公里，是中国保存最完好的古代城垣之一，被誉为'江南完璧'。",
      image: "/荆州古城.png",
      details: "荆州古城墙是我国延续时代最长、跨越朝代最多、由土城发展演变而来的唯一古城垣。城墙高9米左右，厚10米左右，周长11.28公里，设有6座城门、2座藏兵洞和4个马面，是长江中游地区的重要军事防御设施。"
    },
    {
      title: "张居正故居",
      description: "明朝著名政治家、改革家张居正的故居，展示了其生平事迹和明代文化风貌。",
      image: "/张居正故居.jpg",
      details: "张居正(1525-1582)，字叔大，号太岳，荆州人。明代万历年间内阁首辅，实行了一系列改革措施，使明朝出现了短暂的中兴局面。故居内展示了张居正的生平事迹、政治成就以及明代的政治、经济、文化等方面的历史资料。"
    },
    {
      title: "关羽祠",
      description: "为纪念三国时期关羽镇守荆州而建，是关羽文化的重要载体。",
      image: "/关羽.jpg",
      details: "关羽祠位于荆州古城南门内，是为纪念三国时期关羽镇守荆州而建。关羽在荆州期间，曾在此操练兵马、治理百姓，深受民众爱戴。祠内供奉有关羽及其部将的塑像，展示了关羽'忠、义、仁、勇'的精神品质。"
    },
    {
      title: "章华寺",
      description: "始建于元代，是湖北省重点佛教寺院，寺内珍藏有大量佛教文物。",
      image: "/章华.jpeg",
      details: "章华寺位于荆州城东北隅，是湖北省重点文物保护单位。寺内建筑宏伟壮观，古树参天，环境幽静。寺内珍藏有大量的佛教经典、艺术品和文物，是研究荆州佛教文化和历史的重要场所。"
    },
    {
      title: "楚王车马阵",
      description: "战国时期楚国贵族墓地的车马殉葬坑，被誉为'中国地下车马博物馆'。",
      image: "/楚王.webp",
      details: "楚王车马阵位于荆州市荆州区川店镇，是一处规模宏大的战国时期楚国贵族墓地。墓地内出土了大量的车马器、兵器、礼器等文物，其中以车马阵最为著名，被誉为'中国地下车马博物馆'。"
    },
    {
      title: "万寿宝塔",
      description: "始建于明嘉靖年间，是长江中游地区重要的历史文化遗产。",
      image: "/万寿宝塔.jpg",
      details: "万寿宝塔位于荆州市沙市区荆江大堤象鼻矶上，是明嘉靖皇帝为祈盼母亲健康长寿而建。塔高40.76米，八面七层，塔内珍藏有大量的佛像、经文和文物，是研究明代建筑和佛教艺术的重要实物资料。"
    },
  ];

  // 荆州历史人物
  const historicalFigures = [
    {
      name: "伍子胥",
      period: "春秋时期",
      achievement: "吴国大夫，帮助吴国成为春秋五霸之一",
      story: "伍子胥，名员，楚国人。因父兄被楚平王杀害，逃亡吴国，后帮助吴王阖闾成就霸业。曾率吴军攻破楚国郢都，掘楚平王墓鞭尸三百，以报杀父之仇。后因夫差听信谗言，被迫自杀。"
    },
    {
      name: "屈原",
      period: "战国时期",
      achievement: "伟大的爱国诗人，楚辞的创立者",
      story: "屈原，名平，字原，楚国丹阳秭归（今湖北宜昌）人。战国时期楚国诗人、政治家。因遭贵族排挤诽谤，被先后流放至汉北和沅湘流域。楚国郢都被秦军攻破后，自沉于汨罗江，以身殉国。其作品《离骚》《九歌》等是中国古代文学的经典之作。"
    },
    {
      name: "诸葛亮",
      period: "三国时期",
      achievement: "蜀汉丞相，杰出的政治家、军事家、文学家",
      story: "诸葛亮，字孔明，号卧龙，琅琊阳都（今山东沂南）人。三国时期蜀汉丞相，杰出的政治家、军事家、文学家、发明家。曾隐居隆中（今湖北襄阳），后被刘备三顾茅庐请出，辅佐刘备建立蜀汉政权。赤壁之战中，与周瑜联合大破曹军，奠定了三国鼎立的基础。"
    },
    {
      name: "张居正",
      period: "明朝",
      achievement: "明代内阁首辅，著名改革家",
      story: "张居正，字叔大，号太岳，荆州人。明代万历年间内阁首辅，实行了一系列改革措施，包括整顿吏治、推行一条鞭法、加强边防等，使明朝出现了短暂的中兴局面，史称'万历中兴'。其改革对明朝后期的政治、经济、军事等方面产生了深远影响。"
    },
  ];

  // 荆州特色文化
  const culturalFeatures = [
    {
      title: "楚文化",
      description: "荆州是楚文化的发祥地之一，拥有丰富的楚文化遗产。",
      details: "楚文化是中国古代文化的重要组成部分，具有独特的地域特色和文化内涵。荆州作为楚国的重要都城，保存了大量的楚文化遗址和文物，如楚纪南城遗址、熊家冢楚墓群等。楚文化的代表元素包括楚辞、楚乐、楚舞、楚绣等，这些文化遗产是中华民族优秀传统文化的重要组成部分。"
    },
    {
      title: "三国文化",
      description: "荆州是三国时期的重要战场和政治中心，留下了众多三国遗迹。",
      details: "三国时期，荆州是魏、蜀、吴三方争夺的焦点。刘备借荆州、关羽大意失荆州等历史故事都发生在这里。荆州境内保存有大量的三国遗迹，如荆州古城墙、关羽祠、点将台等。这些遗迹反映了三国时期的政治、军事斗争，是研究三国历史的重要实物资料。"
    },
    {
      title: "花鼓戏",
      description: "荆州花鼓戏是湖北地方戏曲剧种之一，具有浓郁的地方特色。",
      details: "荆州花鼓戏是湖北地方戏曲剧种之一，起源于清代，流行于湖北荆州、潜江、天门等地。其音乐风格独特，表演生动活泼，语言通俗易懂，深受当地群众喜爱。代表剧目有《天仙配》《刘海砍樵》等。2006年，荆州花鼓戏被列入第一批国家级非物质文化遗产名录。"
    },
    {
      title: "楚菜",
      description: "荆州菜是楚菜的重要组成部分，以烹制淡水鱼鲜见长。",
      details: "荆州菜是楚菜的重要组成部分，以烹制淡水鱼鲜见长，口味偏重咸鲜，注重原汁原味。代表菜品有荆州鱼糕、洪湖野鸭、公安牛肉、松滋鸡等。荆州鱼糕是荆州传统名菜，以鲜鱼、猪肉、鸡蛋为主要原料，蒸制而成，口感鲜嫩，味道鲜美，被誉为'荆楚第一菜'。"
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-sans text-white">
      {/* 科技感背景网格 */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_rgba(66,153,225,0.15)_0,_transparent_70%)] z-0"></div>
      <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/5 via-purple-900/5 to-cyan-900/5 z-0"></div>
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* 头部区域 */}
        <header className="text-center mb-16">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="h-1 w-16 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-blue-400 uppercase tracking-widest text-sm font-medium">
              AI × 荆州文化
            </span>
            <div className="h-1 w-16 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400">
            穿越古今 · 智慧荆州
          </h1>
          
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-light mb-8">
            人工智能技术赋能荆州历史文化传承与创新，解锁千年古城的数字未来
          </p>
          
          {/* 荆州简介 */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-slate-700/50 max-w-4xl mx-auto shadow-lg shadow-blue-900/10">
            <p className="text-slate-300 leading-relaxed">
              荆州，古称江陵，位于湖北省中南部，长江中游两岸，是国务院公布的首批24座历史文化名城之一。荆州有着3000多年的建城史，是楚文化的发祥地之一，三国文化的中心区域，也是中国历史上的军事重镇和商业都会。
              自公元前689年楚国建都纪南城以来，先后有6个朝代、34位帝王在此建都，被誉为&quot;帝王之都&quot;。荆州境内文物古迹众多，有荆州古城墙、纪南城遗址、熊家冢楚墓群、章华寺等国家级和省级文物保护单位。
            </p>
          </div>
        </header>

        {/* 图片上传和AI分析区域 */}
        <section id="ai-analysis" className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 mb-20 border border-slate-700/50 shadow-xl shadow-blue-900/10 transition-all duration-1000 transform translate-y-8 opacity-0" style={{ transform: isVisible['ai-analysis'] ? 'translateY(0)' : 'translateY(8px)', opacity: isVisible['ai-analysis'] ? 1 : 0 }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-center flex items-center justify-center">
              <span className="text-cyan-400 mr-2">⚡</span>
              <span>AI文化遗产分析</span>
            </h2>
            
            <div className="flex flex-col lg:flex-row gap-8">
              {/* 图片上传区 */}
              <div className="w-full bg-slate-900/60 rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-xl font-medium mb-4 text-white">上传图片</h3>
                <p className="text-slate-300 mb-6 text-sm">上传荆州文化遗产相关图片，AI将为您分析其中的历史文化信息</p>
                <LazyImageProcessor onImageProcessed={(content) => setAiGeneratedContent(content)} />
              </div>
            </div>
          </div>
        </section>

        {/* 荆州文化内容标签页 */}
        <section id="cultural-content" className="mb-20 transition-all duration-1000 transform translate-y-8 opacity-0" style={{ transform: isVisible['cultural-content'] ? 'translateY(0)' : 'translateY(8px)', opacity: isVisible['cultural-content'] ? 1 : 0 }}>
          <h2 className="text-3xl font-semibold mb-8 text-center">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400">
              荆州文化全景
            </span>
          </h2>
          
          {/* 标签页导航 */}
          <div className="flex justify-center mb-10 overflow-x-auto pb-2">
            <div className="inline-flex bg-slate-800/60 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab("history")}
                className={`px-6 py-3 rounded-md text-sm font-medium transition-all duration-300 ${activeTab === "history" ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:text-white'}`}
              >
                历史沿革
              </button>
              <button 
                onClick={() => setActiveTab("heritage")}
                className={`px-6 py-3 rounded-md text-sm font-medium transition-all duration-300 ${activeTab === "heritage" ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:text-white'}`}
              >
                文化遗产
              </button>
              <button 
                onClick={() => setActiveTab("figures")}
                className={`px-6 py-3 rounded-md text-sm font-medium transition-all duration-300 ${activeTab === "figures" ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:text-white'}`}
              >
                历史人物
              </button>
              <button 
                onClick={() => setActiveTab("features")}
                className={`px-6 py-3 rounded-md text-sm font-medium transition-all duration-300 ${activeTab === "features" ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:text-white'}`}
              >
                特色文化
              </button>
            </div>
          </div>
          
          {/* 标签页内容 */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 border border-slate-700/50 shadow-lg shadow-blue-900/10">
            {/* 历史沿革 */}
            {activeTab === "history" && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-xl font-semibold mb-4 text-cyan-300">先秦时期</h3>
                    <p className="text-slate-300 leading-relaxed">
                      荆州历史悠久，早在旧石器时代就有人类活动。新石器时代晚期，这里已经形成了较为发达的原始文化。夏商时期，荆州地区属荆州域，是南方重要的方国。西周时期，楚国逐渐兴起于江汉流域。公元前689年，楚文王迁都于郢（今荆州纪南城），荆州成为楚国的政治、经济、文化中心长达411年。
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-xl font-semibold mb-4 text-cyan-300">秦汉三国</h3>
                    <p className="text-slate-300 leading-relaxed">
                      秦灭楚后，设置南郡，郡治郢城。西汉时期，南郡属荆州刺史部。东汉末年，天下大乱，荆州成为兵家必争之地。赤壁之战后，刘备占据荆州大部分地区。关羽镇守荆州期间，曾在此操练兵马、治理百姓。后吕蒙白衣渡江，关羽大意失荆州，荆州归入东吴版图。
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-xl font-semibold mb-4 text-cyan-300">唐宋元明清</h3>
                    <p className="text-slate-300 leading-relaxed">
                      唐代，荆州为江陵府，是长江中游的重要政治、经济、文化中心。宋代，荆州为荆湖北路治所。元代，设立中兴路，后改为江陵路。明代，设立荆州府，是湖广行省的重要组成部分。清代，荆州仍为府治，是湖北省的重要城市。明清时期，荆州商业繁荣，是长江中游的重要物资集散地。
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-xl font-semibold mb-4 text-cyan-300">近现代</h3>
                    <p className="text-slate-300 leading-relaxed">
                      1912年，废荆州府，设立荆南道。1932年，设立湖北省第七行政督察区，专员公署驻江陵。1949年7月，江陵解放，设立江陵AFP。1994年9月，撤销荆州地区、沙市市和江陵县，设立荆沙市。1996年11月，荆沙市更名为荆州市。2000年，设立荆州区，以原江陵县的行政区域为荆州区的行政区域。
                    </p>
                  </div>
                </div>
                
                {/* 历史时间轴 */}
                <div className="relative py-8">
                  <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-blue-900/50"></div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="md:w-5/12 bg-slate-900/50 rounded-xl p-6 border border-slate-700 text-right">
                      <span className="text-blue-400 font-semibold">公元前689年</span>
                      <p className="text-slate-300 mt-2">楚文王迁都于郢（今荆州纪南城）</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-blue-500 border-4 border-slate-800 z-10"></div>
                    <div className="md:w-5/12"></div>
                  </div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 mt-12">
                    <div className="md:w-5/12"></div>
                    <div className="w-6 h-6 rounded-full bg-blue-500 border-4 border-slate-800 z-10"></div>
                    <div className="md:w-5/12 bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                      <span className="text-blue-400 font-semibold">公元208年</span>
                      <p className="text-slate-300 mt-2">赤壁之战，孙刘联军大败曹军</p>
                    </div>
                  </div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 mt-12">
                    <div className="md:w-5/12 bg-slate-900/50 rounded-xl p-6 border border-slate-700 text-right">
                      <span className="text-blue-400 font-semibold">公元219年</span>
                      <p className="text-slate-300 mt-2">吕蒙白衣渡江，关羽失荆州</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-blue-500 border-4 border-slate-800 z-10"></div>
                    <div className="md:w-5/12"></div>
                  </div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 mt-12">
                    <div className="md:w-5/12"></div>
                    <div className="w-6 h-6 rounded-full bg-blue-500 border-4 border-slate-800 z-10"></div>
                    <div className="md:w-5/12 bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                      <span className="text-blue-400 font-semibold">公元1525年</span>
                      <p className="text-slate-300 mt-2">明代政治家张居正出生于荆州</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* 文化遗产 */}
            {activeTab === "heritage" && (
              <div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {culturalHeritageItems.map((item, index) => (
                      <div 
                        key={index} 
                        className="bg-slate-900/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 relative overflow-hidden"
                      >
                        <div className="h-48 overflow-hidden bg-slate-800 flex items-center justify-center transition-all duration-300 ease-out">
                          <Image 
                            src={item.image} 
                            alt={item.title} 
                            width={400} 
                            height={300} 
                            className="object-cover transition-all duration-500 hover:scale-110 hover:brightness-110 filter w-full h-full" 
                            priority 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end justify-center">
                            <span className="text-white font-medium p-4 text-center">{item.title}</span>
                          </div>
                        </div>
                        <div className="p-6">
                          <h3 className="text-xl font-semibold mb-2 text-white">{item.title}</h3>
                          <p className="text-slate-400 mb-4">{item.description}</p>
                          <div className="mt-4 bg-slate-800/80 rounded-lg p-4">
                            <p className="text-sm text-slate-300 leading-relaxed">{item.details}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {/* 历史人物 */}
            {activeTab === "figures" && (
              <div className="space-y-8">
                {historicalFigures.map((figure, index) => (
                  <div 
                    key={index} 
                    className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition-all duration-300"
                  >
                    <div className="flex flex-col md:flex-row md:items-center mb-4">
                      <h3 className="text-2xl font-semibold text-white mb-2 md:mb-0">{figure.name}</h3>
                      <div className="flex gap-4 md:ml-auto">
                        <span className="inline-block bg-blue-900/50 text-blue-300 text-xs px-3 py-1 rounded-full">{figure.period}</span>
                        <span className="inline-block bg-teal-900/50 text-teal-300 text-xs px-3 py-1 rounded-full">{figure.achievement}</span>
                      </div>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{figure.story}</p>
                  </div>
                ))}
                
                {/* 历史人物影响力展示 */}
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-xl font-semibold mb-6 text-center text-cyan-300">荆州历史人物影响力</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-slate-300">屈原 - 文学影响力</span>
                        <span className="text-sm text-slate-400">95%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: '95%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-slate-300">张居正 - 政治影响力</span>
                        <span className="text-sm text-slate-400">90%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-slate-300">诸葛亮 - 军事影响力</span>
                        <span className="text-sm text-slate-400">88%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: '88%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-slate-300">伍子胥 - 历史影响力</span>
                        <span className="text-sm text-slate-400">85%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* 特色文化 */}
            {activeTab === "features" && (
              <div className="space-y-8">
                {culturalFeatures.map((feature, index) => (
                  <div 
                    key={index} 
                    className="flex flex-col lg:flex-row gap-8 bg-slate-900/50 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition-all duration-300"
                  >
                    <div className="lg:w-1/3 flex flex-col justify-center">
                      <span className="inline-block bg-blue-900/50 text-blue-300 text-xs px-3 py-1 rounded-full mb-3 w-fit">
                        荆州特色文化
                      </span>
                      <h3 className="text-2xl font-semibold text-white mb-3">{feature.title}</h3>
                      <p className="text-slate-400">{feature.description}</p>
                    </div>
                    <div className="lg:w-2/3 bg-slate-800/80 rounded-lg p-6">
                      <p className="text-slate-300 leading-relaxed">{feature.details}</p>
                    </div>
                  </div>
                ))}
                
                {/* 荆州文化传承与创新 */}
                <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl p-8 border border-blue-800/50">
                  <h3 className="text-xl font-semibold mb-4 text-center text-white">荆州文化传承与创新</h3>
                  <p className="text-slate-300 leading-relaxed text-center max-w-3xl mx-auto mb-8">
                    荆州作为历史文化名城，在保护和传承传统文化的同时，也在积极推动文化创新和发展。通过数字化手段、文旅融合、文创产品开发等多种方式，让古老的荆州文化焕发新的生机与活力。
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                      <h4 className="text-lg font-medium text-cyan-300 mb-3">数字化保护</h4>
                      <p className="text-sm text-slate-400">
                        利用3D扫描、虚拟现实等技术，对荆州古城墙、纪南城遗址等文化遗产进行数字化记录和保护，建立数字文化遗产库。
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                      <h4 className="text-lg font-medium text-cyan-300 mb-3">文旅融合</h4>
                      <p className="text-sm text-slate-400">
                        以文化为灵魂，以旅游为载体，推动荆州文化与旅游深度融合，打造荆州古城文化旅游区、纪南城楚文化旅游区等特色旅游品牌。
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                      <h4 className="text-lg font-medium text-cyan-300 mb-3">文创开发</h4>
                      <p className="text-sm text-slate-400">
                        基于荆州丰富的历史文化资源，开发具有荆州特色的文创产品，如楚文化系列文创、三国文化系列文创等，让传统文化走进日常生活。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 荆州文化体验区 */}
        <section id="experience" className="mb-16 transition-all duration-1000 transform translate-y-8 opacity-0" style={{ transform: isVisible['experience'] ? 'translateY(0)' : 'translateY(8px)', opacity: isVisible['experience'] ? 1 : 0 }}>
          <h2 className="text-3xl font-semibold mb-8 text-center">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400">
              荆州文化体验
            </span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-slate-700">
              <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
                <span className="text-cyan-400 mr-2">🏯</span>
                推荐景点
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">•</div>
                  <div>
                    <span className="font-medium text-white">荆州古城墙</span>
                    <p className="text-sm text-slate-400 mt-1">中国保存最完好的古代城垣之一，建议游览时间：2-3小时</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">•</div>
                  <div>
                    <span className="font-medium text-white">纪南城遗址</span>
                    <p className="text-sm text-slate-400 mt-1">楚国郢都遗址，国家重点文物保护单位，建议游览时间：1-2小时</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">•</div>
                  <div>
                    <span className="font-medium text-white">张居正故居</span>
                    <p className="text-sm text-slate-400 mt-1">明代著名政治家张居正的故居，建议游览时间：1小时</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">•</div>
                  <div>
                    <span className="font-medium text-white">章华寺</span>
                    <p className="text-sm text-slate-400 mt-1">湖北省重点佛教寺院，建议游览时间：1-2小时</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-slate-700">
              <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
                <span className="text-cyan-400 mr-2">🍲</span>
                特色美食
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">•</div>
                  <div>
                    <span className="font-medium text-white">荆州鱼糕</span>
                    <p className="text-sm text-slate-400 mt-1">荆州传统名菜，以鲜鱼、猪肉、鸡蛋为原料蒸制而成</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">•</div>
                  <div>
                    <span className="font-medium text-white">公安牛肉</span>
                    <p className="text-sm text-slate-400 mt-1">公安县传统美食，肉质鲜嫩，味道醇厚</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">•</div>
                  <div>
                    <span className="font-medium text-white">洪湖野鸭</span>
                    <p className="text-sm text-slate-400 mt-1">洪湖特产，肉质紧实，营养丰富</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">•</div>
                  <div>
                    <span className="font-medium text-white">沙市早堂面</span>
                    <p className="text-sm text-slate-400 mt-1">沙市传统早点，汤鲜味美，配以各种臊子</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* AI与荆州文化融合区 */}
        <section className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-2xl p-12 border border-blue-800/50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400">
                智慧传承 · 数字荆州
              </span>
            </h2>
            
            <p className="text-slate-300 text-lg leading-relaxed mb-8">
              我们利用先进的人工智能技术，打造个性化荆州文化体验。通过深度学习算法分析用户偏好，为您推荐最适合的历史文化内容，让千年古城焕发数字新生。
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full text-white font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40">
                开始个性化探索
              </button>
              <button className="px-8 py-3 bg-slate-800/80 border border-slate-700 rounded-full text-white font-medium hover:bg-slate-700/80 transition-all duration-300">
                了解技术原理
              </button>
            </div>
          </div>
        </section>
      </main>
      
      {/* 页脚 */}
      <footer className="relative z-10 text-center py-8 border-t border-slate-800">
        <p className="text-slate-500 text-sm">
          © 2024 AI荆州文化体验平台 | 科技赋能传统文化传承
        </p>
      </footer>
    </div>
  );
}

// 优化：移除了重复的代码块，减少不必要的计算和执行