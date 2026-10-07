import { useState } from 'react'
import { faqList } from '../../content/faq'

export default function FAQ() {
  const [openId, setOpenId] = useState<string | null>(faqList[0]?.id || null)

  const toggleFAQ = (id: string) => {
    setOpenId(openId === id ? null : id)
  }

  return (
    <section className="w-full py-10 md:py-16 text-left">
      <div className="mb-8">
        <span className="text-[11px] uppercase tracking-wider text-brand-fg font-bold block mb-1">
          FAQ
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight font-sans">
          Pertanyaan Umum
        </h2>
        <p className="text-sm md:text-base text-subtle mt-1 font-sans">
          Semua hal yang perlu kamu ketahui tentang pemesanan dan keberangkatan.
        </p>
      </div>

      <div className="space-y-3">
        {faqList.map((item) => {
          const isOpen = openId === item.id

          return (
            <div
              key={item.id}
              className={`w-full bg-panel rounded-control border border-line overflow-hidden transition-all ${
                isOpen
                  ? 'border-l-4 border-l-brand-fg shadow-sm'
                  : 'hover:border-brand-fg/50'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleFAQ(item.id)}
                className="w-full p-4 flex items-center justify-between text-left focus:outline-none focus:ring-1 focus:ring-brand-fg cursor-pointer select-none"
              >
                <span
                  className={`text-sm md:text-base font-bold font-sans transition-colors ${
                    isOpen ? 'text-brand-fg' : 'text-ink'
                  }`}
                >
                  {item.question}
                </span>
                <span
                  className={`material-symbols-outlined text-[20px] transition-transform duration-300 select-none ${
                    isOpen ? 'text-brand-fg rotate-180' : 'text-subtle'
                  }`}
                >
                  expand_more
                </span>
              </button>

              <div className={`accordion-wrapper ${isOpen ? 'open' : ''}`}>
                <div className="accordion-content">
                  <div className="px-4 pb-4 text-xs md:text-sm text-subtle font-sans leading-relaxed border-t border-line/40 pt-2">
                    {item.answer}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
