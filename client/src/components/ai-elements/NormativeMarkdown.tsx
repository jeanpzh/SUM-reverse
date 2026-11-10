import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { normativeMarkdownUrl } from '../../data/safeMarkdown'

export function NormativeMarkdown({ children }: { children: string }) {
  // Preserve single linebreaks as soft breaks so prose does not collapse into a single run of text
  const formatted = children.replace(/([^\n])\n([^\n])/g, '$1  \n$2')
  return (
    <div className="typeset typeset-planning min-w-0 overflow-x-auto text-sm [&_pre]:overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={['img', 'a']}
        unwrapDisallowed
        urlTransform={normativeMarkdownUrl}
      >
        {formatted}
      </ReactMarkdown>
    </div>
  )
}
