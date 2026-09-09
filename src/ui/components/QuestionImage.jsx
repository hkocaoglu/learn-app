// Soru görselini gösterir (varsa). Soru metninin ÜSTÜNDE gösterilir.
export default function QuestionImage({ image, alt }) {
  if (!image) return null
  return (
    <div className="question-image">
      <img src={image} alt={alt || 'Soru görseli'} loading="lazy" />
    </div>
  )
}
