import { Lesson } from './types';

export const INITIAL_LESSONS: Lesson[] = [
  {
    id: 'lesson-1',
    title: 'Basic Daily Conversation',
    description: 'Những câu giao tiếp cơ bản hàng ngày về thời tiết và sở thích.',
    level: 'Beginner',
    exercises: [
      {
        id: '101',
        type: 'translation',
        vietnamese: "Hôm nay trời rất đẹp và tôi muốn đi dạo.",
        difficulty: 'Easy',
        hint: "Use 'weather' and 'walk'"
      },
      {
        id: '102',
        type: 'translation',
        vietnamese: "Bạn thích uống cà phê hay trà?",
        difficulty: 'Easy',
        hint: "prefer... or..."
      },
      {
        id: '103',
        type: 'translation',
        vietnamese: "Tôi thường thức dậy lúc 7 giờ sáng mỗi ngày.",
        difficulty: 'Easy',
        hint: "usually wake up"
      }
    ]
  },
  {
    id: 'lesson-2',
    title: 'Traveling & Directions',
    description: 'Học cách hỏi đường và nói về trải nghiệm du lịch.',
    level: 'Intermediate',
    exercises: [
      {
        id: '201',
        type: 'translation',
        vietnamese: "Bạn đã sống ở thành phố này bao lâu rồi?",
        difficulty: 'Medium',
        hint: "Present Perfect Continuous"
      },
      {
        id: '202',
        type: 'translation',
        vietnamese: "Làm ơn cho tôi biết đường đến ga tàu gần nhất.",
        difficulty: 'Medium',
        hint: "Could you tell me the way..."
      },
      {
        id: '203',
        type: 'translation',
        vietnamese: "Chuyến đi đến Nhật Bản năm ngoái là trải nghiệm tuyệt vời nhất của tôi.",
        difficulty: 'Hard',
        hint: "Superlative adjective"
      }
    ]
  },
  {
    id: 'lesson-3',
    title: 'Advanced Grammar Structures',
    description: 'Luyện tập các cấu trúc ngữ pháp phức tạp và câu điều kiện.',
    level: 'Advanced',
    exercises: [
      {
        id: '301',
        type: 'translation',
        vietnamese: "Nếu tôi có nhiều tiền, tôi sẽ mua một ngôi nhà lớn bên bờ biển.",
        difficulty: 'Medium',
        hint: "Second Conditional"
      },
      {
        id: '302',
        type: 'translation',
        vietnamese: "Cuốn sách này thú vị đến mức tôi không thể đặt nó xuống.",
        difficulty: 'Medium',
        hint: "structure: so... that..."
      },
      {
        id: '303',
        type: 'translation',
        vietnamese: "Mặc dù trời mưa to, họ vẫn quyết định tổ chức buổi hòa nhạc ngoài trời.",
        difficulty: 'Hard',
        hint: "Although / Even though"
      }
    ]
  }
];

export const PASS_THRESHOLD = 80;