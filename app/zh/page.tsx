import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, LeaderboardCta, WatchCta } from '@/components/seo/Cta';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { fleetCounts, getWorseData, type ModelWorse } from '@/components/seo/worse/worse-data';
import { isWorseVendor, worseH1, worsePath, type WorseVendorKey } from '@/components/seo/worse/worse-meta';
import { PLANS } from '@/lib/entitlements';
import type { BoardKey } from '@/lib/boards-core';
import { breadcrumbLd, faqLd, graphLd, isoDay, pageMeta, toDate, webPageLd } from '@/lib/seo';
import { VENDORS, type Vendor, type VendorKey } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * /zh: one Simplified-Chinese page for the searches Chinese-speaking visitors use to find the site
 * ("AI 降智雷达", "GPT 降智", "Claude 降智", "AI 智商雷达"). It reads the same data as the English
 * "is your AI getting worse?" pages: the 24-hour boards and each model's per-suite drift detectors,
 * at render time. Static copy names product families only; model names come from the data.
 * ISR, no auth(). The Chinese text is marked lang="zh-Hans" (see zh()); the site chrome stays English.
 */

export const revalidate = 900;

const PATH = '/zh';
const H1 = { title: 'AI 降智雷达', accent: 'GPT、Claude、Gemini 有没有降智？' };
const TITLE = 'AI 降智雷达：GPT、Claude、Gemini 有没有降智？';
const DESCRIPTION = 'AI 降智雷达：用同一套编码、推理和工具调用测试，按固定时间表重测 GPT、Claude、Gemini、DeepSeek、Kimi 和 GLM 模型，按套件检测性能下降，附 24 小时排行与降智提醒。';

export const metadata: Metadata = (() => {
  const m = pageMeta({
    title: TITLE,
    description: DESCRIPTION,
    path: PATH,
    keywords: ['AI降智雷达', 'AI 降智', 'AI智商雷达', 'GPT降智', 'GPT 降智雷达', 'Claude 降智', 'Gemini 降智', 'Codex 降智', '模型降智', 'AI降智测试', '大模型降智检测', '大模型排行榜'],
  });
  return { ...m, openGraph: { ...(m.openGraph ?? {}), locale: 'zh_CN' } };
})();

const ZH_BOARD: Record<BoardKey, string> = { combined: '综合', coding: '编码', reasoning: '推理', tooling: '工具调用' };

const TOC = [
  { id: 'now', label: '现在有没有降智' },
  { id: 'measure', label: '测什么' },
  { id: 'noise', label: '降智还是波动' },
  { id: 'faq', label: '常见问题' },
];
const num = (id: string) => tocNumber(TOC, id);

/**
 * Marks Chinese text. The page's own text carries lang="zh-Hans" element by element, because ReadingPage
 * renders the site's English top bar inside itself and its sections are styled as direct children of .rd,
 * so one wrapper would either mislabel the navigation or break the section styling.
 */
const zh = (s: ReactNode) => <span lang="zh-Hans">{s}</span>;

/** "GPT-6 Luna（编码榜下降、推理检测已触发）" for one flagged model. */
function flaggedText(m: ModelWorse): string {
  const reasons = [
    ...m.downOn.map((k) => `${ZH_BOARD[k]}榜下降`),
    ...m.detectors.filter((d) => d.kind === 'fired').map((d) => `${ZH_BOARD[d.board]}套件检测已触发`),
  ];
  return `${m.model.displayName}（${reasons.join('、')}）`;
}

/** True when at least one model has a detector state (armed, fired or cold), as verdictSentence decides. */
const hasDetectors = (models: ModelWorse[]): boolean => models.some((m) => m.detectors.some((d) => d.kind !== 'none'));

/** One family's answer, the Chinese form of verdictSentence: its models on the boards, and which show a decline. */
function familySentence(family: string, models: ModelWorse[], hasBoards: boolean): string {
  if (!hasBoards) return `榜单数据暂时无法读取，${family} 模型的最新情况见完整排行榜。`;
  const on = models.filter((m) => m.onBoard);
  if (!on.length) return `目前 24 小时榜单上没有 ${family} 模型。`;
  const flagged = on.filter((m) => m.flagged);
  if (!flagged.length) {
    const subject = on.length === 1 ? `榜上唯一的 ${family} 模型没有` : `榜上 ${on.length} 个 ${family} 模型都没有`;
    return `过去 24 小时，${subject}在任何榜单上低于自身近期基线${hasDetectors(on) ? '，降智检测也没有触发' : ''}。`;
  }
  return `过去 24 小时，榜上 ${on.length} 个 ${family} 模型中有 ${flagged.length} 个出现下降信号：${flagged.map(flaggedText).join('；')}。`;
}

/** Several families in one sentence when every one is on the board and none shows a decline; otherwise each family's own sentence. */
function familiesSentence(groups: Array<{ family: string; models: ModelWorse[] }>, hasBoards: boolean): string {
  const on = groups.map((g) => ({ family: g.family, on: g.models.filter((m) => m.onBoard) }));
  const clear = hasBoards && on.length > 1 && on.every((g) => g.on.length > 0 && !g.on.some((m) => m.flagged));
  if (!clear) return groups.map((g) => familySentence(g.family, g.models, hasBoards)).join('');
  const parts = on.map((g) => `${g.on.length} 个 ${g.family} 模型`);
  const list = `${parts.slice(0, -1).join('、')}和 ${parts[parts.length - 1]}`;
  return `过去 24 小时，榜上 ${list}都没有在任何榜单上低于自身近期基线${hasDetectors(on.flatMap((g) => g.on)) ? '，降智检测也没有触发' : ''}。`;
}

/** "2026年10月30日 12:25 UTC": the Chinese form of utcStamp. */
function zhStamp(iso: string): string {
  const d = toDate(iso);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

export default async function ZhPage() {
  const data = await getWorseData();
  const counts = fleetCounts(data.models);
  const hasBoards = !!data.boards;
  const stamp = data.asOf ? zhStamp(data.asOf) : null;
  const coldDays = data.models.flatMap((m) => m.detectors).find((d) => d.kind !== 'none')?.coldStart ?? 10;
  const FREE = PLANS.free;

  const flaggedAll = data.models.filter((m) => m.onBoard && m.flagged);
  const verdict = !hasBoards || counts.onBoard === 0
    ? '榜单数据暂时无法读取；每个模型仍按固定时间表重测，最新情况见完整排行榜。'
    : flaggedAll.length
      ? `过去 24 小时，榜上 ${counts.onBoard} 个模型中有 ${flaggedAll.length} 个出现下降信号：${flaggedAll.map(flaggedText).join('；')}。`
      : `过去 24 小时，榜上 ${counts.onBoard} 个模型都没有在任何榜单上低于自身近期基线${hasDetectors(data.models) ? '，降智检测也没有触发' : ''}。`;
  const detectorLine = counts.series > 0
    ? `${counts.series} 条按套件运行的降智检测中，${counts.armed} 条已就绪且未触发${counts.fired ? `，${counts.fired} 条已触发` : ''}${counts.cold ? `，${counts.cold} 条仍在积累前 ${coldDays} 天的每日数据` : ''}。`
    : null;

  const families = VENDORS.map((v: Vendor) => {
    const models = data.models.filter((m) => m.model.vendor === v.key);
    return { v, models, sentence: familySentence(v.family, models, hasBoards), worse: isWorseVendor(v.key) ? worsePath(v.key) : null };
  }).filter((f) => f.models.length > 0);

  const familyRows: [ReactNode, ReactNode][] = families.map((f) => [
    <Link key={f.v.key} href={f.v.modelsPath}>{f.v.family}</Link>,
    <span key={`${f.v.key}-v`} lang="zh-Hans">
      {f.sentence}
      <Link href={f.v.modelsPath}>{f.v.label} 模型页</Link>
      {f.worse && <>{' · '}<Link href={f.worse}>英文详情</Link></>}
    </span>,
  ]);

  const vendorOf = (key: VendorKey): Vendor | undefined => VENDORS.find((v) => v.key === key);
  const group = (key: VendorKey) => ({ family: vendorOf(key)?.family ?? key, models: data.models.filter((m) => m.model.vendor === key) });
  const fam = (key: VendorKey): string => familySentence(group(key).family, group(key).models, hasBoards);
  const others: VendorKey[] = ['deepseek', 'kimi', 'glm'];
  const worseLink = (k: WorseVendorKey): string => `[${worseH1(k)}](${worsePath(k)})`;
  const modelsLink = (key: VendorKey): string => {
    const v = vendorOf(key);
    return v ? `[${v.family}](${v.modelsPath})` : '';
  };

  const faq: FaqItem[] = [
    { q: 'GPT 降智了吗？', a: `${fam('openai')}逐个模型的英文详情见 ${worseLink('openai')}。` },
    { q: 'Claude 降智了吗？', a: `${fam('anthropic')}逐个模型的英文详情见 ${worseLink('anthropic')}。` },
    { q: 'Gemini 降智了吗？', a: `${fam('google')}逐个模型的英文详情见 ${worseLink('google')}。` },
    {
      q: 'DeepSeek、Kimi 和 GLM 降智了吗？',
      a: `${familiesSentence(others.map(group), hasBoards)}各家模型页：${others.map(modelsLink).filter(Boolean).join('、')}；DeepSeek 的英文详情见 ${worseLink('deepseek')}。`,
    },
    {
      q: 'AI 降智雷达多久更新一次？',
      a: '编码每 4 小时重测一次，推理和工具调用每天一次，另有每小时运行的金丝雀探针。24 小时榜单是每个模型过去一天各次运行的平均值，一次偶然的失误不会改变名次。',
    },
    {
      q: '降智和正常波动怎么区分？',
      a: `每个模型的每个套件都有独立的 Page-Hinkley 变点检测（一种 CUSUM 类检验），基于每日中位数运行，在当前测试版本上积累 ${coldDays} 天每日数据后才会就绪，所以真正的下降要用几天来确认，而不是几个小时。单次答错不是证据：模型没有任何变化时，输出也会有波动。方法详见 [AI drift detection](/ai-drift-detection)。`,
    },
    {
      q: '模型降智时能收到提醒吗？',
      a: `可以。免费账户可以关注 ${FREE.watchedModels} 个模型：被关注模型的编码分数比一周前低 5 分时发邮件，每周还有一份变化摘要。无需信用卡。`,
    },
  ];

  const page = webPageLd({ path: PATH, name: TITLE, description: DESCRIPTION, ...(data.asOf ? { dateModified: isoDay(data.asOf) } : {}) });
  const ld = graphLd([
    breadcrumbLd([{ name: '首页', path: '/' }, { name: 'AI 降智雷达', path: PATH }]),
    { ...page, inLanguage: 'zh-Hans' },
    faqLd(faq),
  ]);

  const watchSub = `免费关注 ${FREE.watchedModels} 个模型 · 编码分数比一周前低 5 分时发邮件`;
  const boardSub = `免费账户 · 24 小时、7 天和 ${FREE.historyDays} 天视图 · 无需信用卡`;

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        kicker="AI 降智雷达 · 过去 24 小时"
        title={zh(H1.title)}
        accent={zh(H1.accent)}
        lead={zh(verdict)}
        actions={(
          <div lang="zh-Hans">
            <CtaRow className="is-stack">
              <WatchCta cta="zh-hero-watch" label="关注模型，变化时邮件提醒 →" sub={watchSub} />
              <LeaderboardCta cta="zh-hero-leaderboard" ghost label="查看完整排行榜 →" sub={boardSub} loginText={['已有账户？', '登录']} />
            </CtaRow>
          </div>
        )}
        note={stamp ? zh(`数据时间：${stamp} · 24 小时榜单 · 按套件的 Page-Hinkley 降智检测`) : undefined}
        aside={counts.onBoard > 0 ? (
          <dl className="lp-facts" lang="zh-Hans">
            <div><dt>{counts.onBoard}</dt><dd>个模型在 24 小时榜单上，全部使用同一套测试</dd></div>
            {counts.series > 0 && <div><dt>{counts.armed}/{counts.series}</dt><dd>条按套件的降智检测已就绪且未触发</dd></div>}
            <div><dt>4 小时</dt><dd>编码套件的重测间隔；推理和工具调用每天一次</dd></div>
          </dl>
        ) : undefined}
        toc={TOC}
        tocLabel="本页内容"
        final={(
          <RdFinal
            title={zh('关注你在用的模型')}
            lead={zh(`免费账户：24 小时、7 天和 ${FREE.historyDays} 天的全部排行，关注 ${FREE.watchedModels} 个模型并接收邮件提醒，每月 ${FREE.routerRequestsPerMonth.toLocaleString('en-US')} 次智能路由请求和一个数据 API 密钥。无需信用卡。`)}
            actions={(
              <div lang="zh-Hans">
                <CtaRow>
                  <WatchCta cta="zh-final-watch" label="关注模型，变化时邮件提醒 →" sub={watchSub} />
                  <LeaderboardCta cta="zh-final-leaderboard" ghost label="查看完整排行榜 →" sub={boardSub} loginText={['已有账户？', '登录']} />
                </CtaRow>
              </div>
            )}
          />
        )}
      >
        <RdSection id="now" n={num('now')} title={zh('现在有没有模型降智？')} lead={zh('按模型家族看：24 小时榜单上的表现，和每个套件的降智检测。')}>
          {detectorLine && <RdProse><p lang="zh-Hans">{detectorLine}</p></RdProse>}
          {familyRows.length > 0 && <RdRows rows={familyRows} />}
          <RdProse>
            <p lang="zh-Hans">
              完整名次见 <Link href="/leaderboard">AI 排行榜</Link>（英文），逐个模型的降智检测见{' '}
              <Link href="/is-ai-getting-worse" lang="en">Is your AI getting worse?</Link>（英文）。
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="measure" n={num('measure')} title={zh('AI 降智雷达测什么？')}
          lead={zh('每个模型做同一套题，按同一个时间表重测，用运行代码的方式判分。')}>
          <RdProse>
            <p lang="zh-Hans">
              {'编码每 4 小时重测一次：真实代码仓库里的调试任务，用项目自己的测试判分，包括模型看不到的隐藏测试。推理每天一次：多轮的长时间工作会话，前面给出的规则在后面的每一步都用代码检查，而不是让另一个模型打分。工具调用每天一次：任务在沙盒机器里执行，结束时任务要么完成，要么没完成。另有每小时运行的金丝雀探针，用来发现突然的下降。'}
            </p>
            <p lang="zh-Hans">
              {'每个模型都像应用程序一样，通过各家的公开 API 调用；分数来自我们自己的运行，不是厂商公布的数字。方法公开：每个权重、统计检验和漂移常数都已发布；测试题目不公开，避免被针对性训练。完整方法见 '}
              <Link href="/methodology" lang="en">methodology</Link>（英文）。
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="noise" n={num('noise')} title={zh('怎么区分真降智和正常波动？')}
          lead={zh('单次答错不是证据：模型没有任何变化时，输出也会波动。')}>
          <RdProse>
            <p lang="zh-Hans">
              {`每个模型的每个套件都有独立的 Page-Hinkley 变点检测（一种 CUSUM 类检验），基于每日中位数运行，并与这个模型自己的过去比较。检测在当前测试版本上积累 ${coldDays} 天每日数据后才会就绪，所以真正的下降要用几天来确认，而不是几个小时。常数公开：δ 0.01；编码和推理 λ 0.30；工具调用 λ 0.50，且需要连续三天的每日结果超过阈值。`}
            </p>
            <p lang="zh-Hans">
              {'每小时的金丝雀探针（两道固定题目）用 Welch t 检验捕捉突然的下降（下降 12 分，p < 0.01）。检测方法见 '}
              <Link href="/ai-drift-detection" lang="en">AI drift detection</Link>
              {'（英文），实测的误报率见 '}
              <Link href="/research/drift-detector-false-alarm-rate" lang="en">How often our drift detector is wrong, measured</Link>（英文）。
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title={zh('常见问题')}>
          <div lang="zh-Hans"><Faq items={faq} /></div>
        </RdSection>
      </ReadingPage>
    </>
  );
}
