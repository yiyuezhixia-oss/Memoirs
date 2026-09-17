import type { ChatMessage, GenerationResult, GenerationType, MemoryDraft } from '../types';

type ChatPurpose = 'memory' | GenerationType;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const memoryQuestions = [
  '这是谁的哪一段回忆？你可以先发一张照片，或者直接告诉我发生了什么。',
  '那一刻，你心里最强烈的感受是什么？',
  '还记得当时的天气、地点或其他小细节吗？这些都会让这段回忆更完整。',
];

const questions: Record<GenerationType, string[]> = {
  article: [
    '这篇文章想写给孩子本人，还是给家人一起看？',
    '你最想让他记住哪一句，或者最想表达的一个感受是什么？',
    '文风想更像温柔家书，还是故事散文？还有没有特别想保留的细节？',
  ],
  comic: [
    '这段回忆里，你最想变成漫画的是哪一幕？',
    '画面里的人物是什么动作和表情？希望整体是什么情绪？',
    '有没有想保留的对白、场景细节或分镜数量？',
  ],
  'diary-card': [
    '这张卡片最想保留哪一句话？',
    '标题想温柔一点，还是纪念感强一点？',
    '主图之外，还有天气、地点或当时的心情想写进卡片吗？',
  ],
};

const resultByType: Record<GenerationType, GenerationResult> = {
  article: {
    title: '写给毕业那天的你',
    text: '那天，阳光很好，人也很多。\n\n你穿着学士服，在人群里像一颗小小的星星，来回找我。然后，你突然跑过来，紧紧地抱住了我。\n\n那一刻，我的心里一下子被填得满满的。我开心，因为你真的长大了，完成了人生中一个重要的阶段；我也有一点舍不得，因为我知道，你会走得越来越远。\n\n这些年，看着你从小小的你，变成了现在独立、勇敢的你，妈妈一直为你骄傲。去大胆地追逐自己的梦想吧，孩子。妈妈爱你，永远爱你。',
    metadata: { mood: '温柔', usage: '写给孩子的一封信' },
  },
  comic: {
    title: '毕业那天的一个拥抱',
    imageUrls: ['https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1000&q=85'],
    metadata: { panels: '6格', style: '温暖治愈', notice: '亲子氛围插画，不承诺真人还原' },
  },
  'diary-card': {
    title: '第一次骑自行车',
    text: '你小心翼翼地握着车把，我在后面扶着你，风一吹过，我们都在笑。',
    imageUrls: ['https://images.unsplash.com/photo-1502744688674-c619d1586c9e?auto=format&fit=crop&w=900&q=85'],
    metadata: { date: '2026.05', location: '公园的小路', mood: '晴' },
  },
};

function countUserMessages(messages: ChatMessage[]) {
  return messages.filter((message) => message.role === 'user').length;
}

function detectMemoryDraft(messages: ChatMessage[]): MemoryDraft {
  const joined = messages.filter((message) => message.role === 'user').map((message) => message.content).join(' ');
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')?.content?.trim();

  if (joined.includes('毕业') || joined.includes('拥抱')) {
    return {
      datePrecision: 'month',
      startDate: '2026-06',
      title: '毕业那天的拥抱',
      content: '他从人群里跑过来抱住我，我开心，也有一点舍不得。那一刻，我突然觉得他真的长大了。',
      imageDataUrls: [],
    };
  }

  if (joined.includes('谢谢')) {
    return {
      datePrecision: 'day',
      startDate: '2026-08-05',
      title: '第一次认真说谢谢',
      content: '吃完晚饭，他突然拿出画好的小卡片，很认真地说：“谢谢妈妈每天陪我。”那一刻，心里暖暖的。',
      imageDataUrls: [],
    };
  }

  if (joined.includes('自行车') || joined.includes('骑车')) {
    return {
      datePrecision: 'day',
      startDate: '2026-05-20',
      title: '第一次骑自行车',
      content: '你小心翼翼地握着车把，我在后面扶着你。风吹过时，我们都在笑。',
      imageDataUrls: [],
    };
  }

  return {
    datePrecision: 'day',
    startDate: '2026-08-05',
    title: lastUser?.slice(0, 14) || '一段新的回忆',
    content: lastUser ? `根据你刚刚说的内容整理：${lastUser}` : '我会把这段回忆整理成一页时光书。',
    imageDataUrls: [],
  };
}

export async function nextQuestion(purpose: ChatPurpose, messages: ChatMessage[]) {
  await wait(650);
  const answered = countUserMessages(messages);
  if (purpose === 'memory') {
    return memoryQuestions[Math.min(answered, memoryQuestions.length - 1)];
  }
  return questions[purpose][Math.min(answered, questions[purpose].length - 1)];
}

export async function organizeMemory(messages: ChatMessage[] = []): Promise<MemoryDraft> {
  await wait(900);
  return detectMemoryDraft(messages);
}

export async function generateWork(type: GenerationType): Promise<GenerationResult> {
  await wait(1100);
  return resultByType[type];
}
