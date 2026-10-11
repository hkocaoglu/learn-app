// Sınıf bazlı ödül havuzları (yerel mod seed'i).
// classKey = "grade:N" — cloud tarafı bu alan yerine class_id kullanır.
import { uid, nowIso } from '../domain/model.js'

// Her sınıf kendi havuzuna sahiptir (kullanıcı kararı: sınıf bazlı ödül).
// quantity = kalan adet; ilk kazanan alır (first-come-first-served).
const POOLS = {
  1: [
    { name: 'Renkli silgi', icon: '🧽', cost: 5, quantity: 30, description: 'Pembe/mavi silgi' },
    { name: 'Kırmızı kalem', icon: '🖊️', cost: 10, quantity: 10, description: '10 adet — ilk 10 öğrenci' },
    { name: 'Çıkartma seti', icon: '⭐', cost: 20, quantity: 8, description: 'Hayvan çıkartmaları' },
    { name: 'Boyama kitabı', icon: '🎨', cost: 40, quantity: 4, description: '60 sayfa boyama' },
    { name: 'Sınıf rozeti', icon: '🏅', cost: 75, quantity: 2, description: 'Ayın öğrencisi rozeti' }
  ],
  2: [
    { name: 'Kurşun kalem', icon: '✏️', cost: 5, quantity: 30, description: 'HB kurşun kalem' },
    { name: 'Kırmızı kalem', icon: '🖊️', cost: 10, quantity: 10, description: '10 adet — ilk 10 öğrenci' },
    { name: 'Defter', icon: '📓', cost: 25, quantity: 6, description: '40 yapraklı çizgili defter' },
    { name: 'Boyama kitabı', icon: '🎨', cost: 40, quantity: 4, description: '60 sayfa boyama' },
    { name: 'Sınıf rozeti', icon: '🏅', cost: 75, quantity: 2, description: 'Ayın öğrencisi rozeti' }
  ],
  3: [
    { name: 'Silgi', icon: '🧽', cost: 5, quantity: 25, description: 'Beyaz silgi' },
    { name: 'Kırmızı kalem', icon: '🖊️', cost: 10, quantity: 10, description: '10 adet — ilk 10 öğrenci' },
    { name: 'Cetvel seti', icon: '📏', cost: 25, quantity: 6, description: '30 cm + 15 cm cetvel' },
    { name: 'Defter', icon: '📓', cost: 30, quantity: 6, description: '40 yapraklı çizgili defter' },
    { name: 'Boyama kitabı', icon: '🎨', cost: 45, quantity: 4, description: 'Mandalina boyama' },
    { name: 'Sınıf rozeti', icon: '🏅', cost: 80, quantity: 2, description: 'Ayın öğrencisi rozeti' }
  ],
  4: [
    { name: 'Kırmızı kalem', icon: '🖊️', cost: 10, quantity: 10, description: '10 adet — ilk 10 öğrenci' },
    { name: 'Kalemtıraş', icon: '✏️', cost: 15, quantity: 12, description: 'Kutulu kalemtıraş' },
    { name: 'Defter', icon: '📓', cost: 30, quantity: 6, description: '80 yapraklı defter' },
    { name: 'Hesap makinesi', icon: '🧮', cost: 60, quantity: 3, description: 'Temel işlem hesap makinesi' },
    { name: 'Sınıf rozeti', icon: '🏅', cost: 90, quantity: 2, description: 'Ayın öğrencisi rozeti' }
  ],
  5: [
    { name: 'Kırmızı kalem', icon: '🖊️', cost: 10, quantity: 10, description: '10 adet — ilk 10 öğrenci' },
    { name: 'Kapaklı defter', icon: '📓', cost: 35, quantity: 6, description: '80 yapraklı kapaklı defter' },
    { name: 'Fiber kalem seti', icon: '🖊️', cost: 50, quantity: 4, description: '4 renkli fiber kalem' },
    { name: 'Hesap makinesi', icon: '🧮', cost: 60, quantity: 3, description: 'Temel işlem hesap makinesi' },
    { name: 'Kutu oyunu', icon: '🎲', cost: 120, quantity: 1, description: 'Sınıf ödüllü zeka oyunu' },
    { name: 'Sınıf rozeti', icon: '🏅', cost: 90, quantity: 2, description: 'Ayın öğrencisi rozeti' }
  ],
  6: [
    { name: 'Kırmızı kalem', icon: '🖊️', cost: 10, quantity: 10, description: '10 adet — ilk 10 öğrenci' },
    { name: 'Kapaklı defter', icon: '📓', cost: 35, quantity: 6, description: '80 yapraklı kapaklı defter' },
    { name: 'Fiber kalem seti', icon: '🖊️', cost: 50, quantity: 4, description: '4 renkli fiber kalem' },
    { name: 'Hesap makinesi', icon: '🧮', cost: 60, quantity: 3, description: 'Bilimsel hesap makinesi' },
    { name: 'Kutu oyunu', icon: '🎲', cost: 120, quantity: 1, description: 'Sınıf ödüllü zeka oyunu' },
    { name: 'Sınıf rozeti', icon: '🏅', cost: 90, quantity: 2, description: 'Ayın öğrencisi rozeti' }
  ]
}

export const buildSeedRewards = () => {
  const rewards = []
  Object.entries(POOLS).forEach(([grade, items]) => {
    items.forEach((item) => {
      rewards.push({
        id: uid('rw'),
        classKey: `grade:${grade}`,
        name: item.name,
        icon: item.icon,
        cost: item.cost,
        quantity: item.quantity,
        description: item.description || '',
        active: true,
        redemptionCount: 0,
        createdAt: nowIso()
      })
    })
  })
  return rewards
}
