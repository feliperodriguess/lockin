import { useDDragon } from "@renderer/hooks/use-data"
import { useSummoner } from "@renderer/hooks/use-lcu"
import { profileIconUrl } from "@renderer/lib/ddragon-urls"

export function SidebarIdentity(): React.JSX.Element | null {
	const summoner = useSummoner()
	const { data: bundle } = useDDragon()

	if (!summoner) return null

	const version = bundle?.version ?? ""
	const avatar = version ? profileIconUrl(version, summoner.profileIconId) : null

	return (
		<div className="region-no-drag flex items-center gap-[8px] pb-1">
			{avatar ? (
				<img
					src={avatar}
					alt=""
					width={32}
					height={32}
					className="size-8 shrink-0 rounded-full border border-(--stroke-default) object-cover bg-ink-800"
				/>
			) : (
				<span className="size-6 shrink-0 rounded-full border border-(--stroke-default) bg-ink-800" />
			)}
			<span className="flex min-w-0 flex-col gap-px">
				<span className="truncate text-[13px] font-medium leading-[1.1] text-paper-100">
					{summoner.gameName}
				</span>
				<span className="font-mono text-[11px] font-normal leading-none text-paper-400">
					#{summoner.tagLine}
				</span>
			</span>
		</div>
	)
}
