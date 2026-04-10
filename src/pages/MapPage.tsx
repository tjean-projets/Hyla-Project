import { useState, useEffect, useRef, useCallback } from 'react'
import { Map, Overlay } from 'pigeon-maps'
import { osm } from 'pigeon-maps/providers'
import { AppLayout } from '../components/AppLayout'
import { useEffectiveUserId } from '../hooks/useEffectiveUser'
import { supabase, HYLA_LEVELS } from '../lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MapPin,
  Search,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Filter,
} from 'lucide-react'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { ScrollArea } from '../components/ui/scroll-area'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface MapMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  status: string
  hyla_level: string | null
  address: string | null
  lat: number | null
  lng: number | null
}

interface GeocodedMember extends MapMember {
  resolvedLat: number | null
  resolvedLng: number | null
}

// ── Constants ──────────────────────────────────────────────────────────────

const FRANCE_CENTER: [number, number] = [46.5, 2.3]
const FRANCE_ZOOM = 6

const LEVEL_COLORS: Record<string, string> = {
  vendeur: '#3b82f6',
  manager: '#8b5cf6',
  chef_groupe: '#f97316',
  chef_agence: '#f97316',
  distributeur: '#f59e0b',
  elite_bronze: '#d97706',
  elite_argent: '#94a3b8',
  elite_or: '#eab308',
}

const LEVEL_BADGE_CLASSES: Record<string, string> = {
  vendeur: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  manager: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  chef_groupe: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  chef_agence: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  distributeur: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  elite_bronze: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  elite_argent: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  elite_or: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getLevelLabel(level: string | null): string {
  if (!level) return 'Vendeur'
  return HYLA_LEVELS.find(l => l.value === level)?.label ?? level
}

function getMemberName(m: MapMember): string {
  const full = [m.first_name, m.last_name].filter(Boolean).join(' ')
  return full.trim() || m.email || 'Membre'
}

function getLevelColor(level: string | null): string {
  return LEVEL_COLORS[level ?? ''] ?? '#6b7280'
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fr`,
      { headers: { 'Accept-Language': 'fr' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    // silently ignore network errors
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Member card ────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: GeocodedMember
  onClick: (m: GeocodedMember) => void
  selected: boolean
}

function MemberCard({ member, onClick, selected }: MemberCardProps) {
  const hasLocation = member.resolvedLat !== null && member.resolvedLng !== null
  const name = getMemberName(member)
  const levelLabel = getLevelLabel(member.hyla_level)
  const levelClass =
    LEVEL_BADGE_CLASSES[member.hyla_level ?? ''] ?? LEVEL_BADGE_CLASSES.vendeur

  return (
    <button
      type="button"
      onClick={() => hasLocation && onClick(member)}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg border transition-all',
        hasLocation ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default opacity-70',
        selected ? 'border-primary bg-primary/5' : 'border-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
            style={{ background: getLevelColor(member.hyla_level) }}
          />
          <span className="text-sm font-medium truncate">{name}</span>
        </div>
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 leading-4 border-0 flex-shrink-0', levelClass)}
        >
          {levelLabel}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-1 ml-4">
        {member.address ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {member.address}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Localisation manquante
          </span>
        )}
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0 leading-4 border-0 ml-auto',
            member.status === 'actif'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          )}
        >
          {member.status === 'actif' ? 'Actif' : 'Inactif'}
        </Badge>
      </div>
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function MapPage() {
  const effectiveUserId = useEffectiveUserId()
  const queryClient = useQueryClient()

  // filters
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // map state (controlled)
  const [center, setCenter] = useState<[number, number]>(FRANCE_CENTER)
  const [zoom, setZoom] = useState(FRANCE_ZOOM)

  // selected member for popup and list highlight
  const [selectedMember, setSelectedMember] = useState<GeocodedMember | null>(null)

  // mobile list sheet
  const [mobileListOpen, setMobileListOpen] = useState(false)

  // geocoded members enriched client-side
  const [geocodedMembers, setGeocodedMembers] = useState<GeocodedMember[]>([])
  const [isGeocoding, setIsGeocoding] = useState(false)
  const geocodingAbortRef = useRef(false)

  // ── Fetch members ──
  const { data: rawMembers, isLoading } = useQuery<MapMember[]>({
    queryKey: ['map-members', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return []
      const { data, error } = await supabase
        .from('team_members')
        .select('id, first_name, last_name, email, status, hyla_level, lat, lng, contacts(address)')
        .eq('user_id', effectiveUserId)
        .order('first_name')
      if (error) throw error
      return (data ?? []).map((m: any) => ({
        ...m,
        address: m.contacts?.address ?? null,
      })) as MapMember[]
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  })

  // ── Auto-geocode members with address but no coordinates ──
  const runGeocoding = useCallback(
    async (members: MapMember[]) => {
      geocodingAbortRef.current = false

      const enriched: GeocodedMember[] = members.map(m => ({
        ...m,
        resolvedLat: m.lat,
        resolvedLng: m.lng,
      }))
      setGeocodedMembers(enriched)

      const toGeocode = enriched.filter(
        m => m.address && (m.resolvedLat === null || m.resolvedLng === null)
      )
      if (toGeocode.length === 0) return

      setIsGeocoding(true)
      for (const member of toGeocode) {
        if (geocodingAbortRef.current) break
        const coords = await geocode(member.address!)
        if (coords) {
          setGeocodedMembers(prev =>
            prev.map(m =>
              m.id === member.id
                ? { ...m, resolvedLat: coords.lat, resolvedLng: coords.lng }
                : m
            )
          )
          await supabase
            .from('team_members')
            .update({ lat: coords.lat, lng: coords.lng } as unknown as Record<string, unknown>)
            .eq('id', member.id)
        }
        await sleep(1000) // Nominatim rate limit: 1 req/sec
      }
      setIsGeocoding(false)
      queryClient.invalidateQueries({ queryKey: ['map-members', effectiveUserId] })
    },
    [effectiveUserId, queryClient]
  )

  useEffect(() => {
    if (!rawMembers) return
    geocodingAbortRef.current = true // abort any in-progress run
    runGeocoding(rawMembers)
  }, [rawMembers, runGeocoding])

  useEffect(() => {
    return () => {
      geocodingAbortRef.current = true
    }
  }, [])

  // ── Filtered members ──
  const displayedMembers = geocodedMembers.filter(m => {
    const name = getMemberName(m).toLowerCase()
    const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase())
    const matchLevel = levelFilter === 'all' || m.hyla_level === levelFilter
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchLevel && matchStatus
  })

  const membersOnMap = displayedMembers.filter(
    m => m.resolvedLat !== null && m.resolvedLng !== null
  )

  // ── Click member in list → fly to pin ──
  const handleMemberClick = useCallback((member: GeocodedMember) => {
    if (member.resolvedLat === null || member.resolvedLng === null) return
    setCenter([member.resolvedLat, member.resolvedLng])
    setZoom(12)
    setSelectedMember(member)
    setMobileListOpen(false)
  }, [])

  // ── Sub-components ──

  const filterBar = (
    <div className="flex flex-wrap gap-2 items-center p-2 bg-background/80 backdrop-blur-sm border-b">
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un membre..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Select value={levelFilter} onValueChange={setLevelFilter}>
        <SelectTrigger className="h-8 text-sm w-[160px]">
          <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Niveau" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les niveaux</SelectItem>
          {HYLA_LEVELS.map(l => (
            <SelectItem key={l.value} value={l.value}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 text-sm w-[130px]">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="actif">Actif</SelectItem>
          <SelectItem value="inactif">Inactif</SelectItem>
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap flex items-center gap-1">
        <Users className="w-3.5 h-3.5" />
        {displayedMembers.length} / {geocodedMembers.length} membre
        {geocodedMembers.length !== 1 ? 's' : ''}
        {isGeocoding && (
          <span className="ml-2 text-primary flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Géocodage…
          </span>
        )}
      </span>
    </div>
  )

  const memberListPanel = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Membres</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {displayedMembers.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 flex flex-col gap-1">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : displayedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <MapPin className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun membre trouvé</p>
              <p className="text-xs mt-1 opacity-70">Ajustez les filtres</p>
            </div>
          ) : (
            displayedMembers.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                onClick={handleMemberClick}
                selected={selectedMember?.id === member.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )

  const mapArea = (
    <div className="relative h-full w-full">
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Chargement de la carte…</span>
          </div>
        </div>
      ) : (
        <Map
          provider={osm}
          center={center}
          zoom={zoom}
          onBoundsChanged={({ center: c, zoom: z }) => {
            setCenter(c)
            setZoom(z)
          }}
          height={undefined as unknown as number}
          style={{ height: '100%', width: '100%' }}
          onClick={() => setSelectedMember(null)}
        >
          {/* Colored dot markers */}
          {membersOnMap.map(member => (
            <Overlay
              key={member.id}
              anchor={[member.resolvedLat!, member.resolvedLng!]}
              offset={[8, 8]}
            >
              <div
                onClick={e => {
                  e.stopPropagation()
                  setSelectedMember(member)
                }}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: getLevelColor(member.hyla_level),
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.4)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                }}
              />
            </Overlay>
          ))}

          {/* Popup for selected member */}
          {selectedMember &&
            selectedMember.resolvedLat !== null &&
            selectedMember.resolvedLng !== null && (
              <Overlay
                anchor={[selectedMember.resolvedLat, selectedMember.resolvedLng]}
                offset={[-80, 100]}
              >
                <div
                  className="bg-white rounded-xl shadow-xl border text-sm"
                  style={{ width: 200, position: 'relative' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Colour strip at top */}
                  <div
                    className="h-1 rounded-t-xl"
                    style={{ background: getLevelColor(selectedMember.hyla_level) }}
                  />
                  <div className="p-3">
                    <button
                      onClick={() => setSelectedMember(null)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 leading-none"
                      aria-label="Fermer"
                    >
                      ✕
                    </button>
                    <p className="font-semibold pr-4 truncate">
                      {getMemberName(selectedMember)}
                    </p>
                    {selectedMember.address && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {selectedMember.address}
                      </p>
                    )}
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: getLevelColor(selectedMember.hyla_level) + '22',
                          color: getLevelColor(selectedMember.hyla_level),
                        }}
                      >
                        {getLevelLabel(selectedMember.hyla_level)}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium',
                          selectedMember.status === 'actif'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        )}
                      >
                        {selectedMember.status === 'actif' ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>
                </div>
              </Overlay>
            )}
        </Map>
      )}

      {/* No-location banner */}
      {!isLoading && membersOnMap.length === 0 && (
        <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none z-10">
          <div className="bg-background/90 backdrop-blur-sm border rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg pointer-events-auto mx-4">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Aucun membre localisé</p>
              <p className="text-xs text-muted-foreground">
                Ajoutez une adresse à vos membres pour les afficher sur la carte.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <AppLayout title="Carte de l'équipe" variant="light">
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden -mx-4 -mt-4 md:-mx-6 md:-mt-6">
        {filterBar}

        <div className="flex flex-1 overflow-hidden">
          {/* Map — flex-1 on desktop */}
          <div className="flex-1 relative h-full">
            {mapArea}
          </div>

          {/* Member list panel — desktop only */}
          <div className="hidden md:flex flex-col w-72 border-l bg-background h-full overflow-hidden">
            {memberListPanel}
          </div>
        </div>

        {/* Mobile: floating toggle + bottom sheet */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMobileListOpen(v => !v)}
            className="fixed bottom-20 right-4 z-20 bg-primary text-primary-foreground rounded-full shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm font-medium"
          >
            <Users className="w-4 h-4" />
            {displayedMembers.length} membre{displayedMembers.length !== 1 ? 's' : ''}
            {mobileListOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>

          <div
            className={cn(
              'fixed inset-x-0 bottom-0 z-30 bg-background border-t rounded-t-2xl shadow-2xl transition-transform duration-300',
              mobileListOpen ? 'translate-y-0' : 'translate-y-full'
            )}
            style={{ maxHeight: '60vh' }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="h-[calc(60vh-24px)]">{memberListPanel}</div>
          </div>

          {mobileListOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/20"
              onClick={() => setMobileListOpen(false)}
            />
          )}
        </div>
      </div>
    </AppLayout>
  )
}
