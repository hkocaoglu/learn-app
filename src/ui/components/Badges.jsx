import { gradeLabel, subjectLabel, topicLabel } from '../../domain/model.js'

export function GradeBadge({ grade }) {
  return <span className="badge badge-grade">{gradeLabel(grade)}</span>
}

export function SubjectBadge({ subject }) {
  return <span className="badge badge-subject">{subjectLabel(subject)}</span>
}

export function TopicBadge({ topic }) {
  return <span className="badge badge-topic">{topicLabel(topic)}</span>
}
