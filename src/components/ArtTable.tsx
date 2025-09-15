import { useEffect, useRef, useState, useCallback } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { fetchArtworks } from '../api'
import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import { InputNumber } from 'primereact/inputnumber'

type Artwork = {
  id: number
  title: string
  place_of_origin: string | null
  artist_display: string | null
  inscriptions: string | null
  date_start: number | null
  date_end: number | null
}

type ArtworkApiResponse = {
  id: number
  title: string
  place_of_origin: string | null
  artist_display: string | null
  inscription?: string | null
  inscriptions?: string | null
  date_start: number | null
  date_end: number | null
}

export default function ArtTable() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Artwork[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState<number | null>(null)
  const [perPage, setPerPage] = useState<number>(12)
  const [localSelectedRows, setLocalSelectedRows] = useState<Artwork[]>([])
  const [globalSelectCount, setGlobalSelectCount] = useState<number>(0)
  const op = useRef<OverlayPanel | null>(null)

  const STORAGE_SELECTED = 'artic_selected_ids_v1'
  const STORAGE_DESELECTED = 'artic_deselected_ids_v1'
  const STORAGE_GLOBAL = 'artic_global_count_v1'

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deselectedIds, setDeselectedIds] = useState<Set<number>>(new Set())

  // Load persisted state
  useEffect(() => {
    const s = localStorage.getItem(STORAGE_SELECTED)
    const d = localStorage.getItem(STORAGE_DESELECTED)
    const g = localStorage.getItem(STORAGE_GLOBAL)
    if (s) setSelectedIds(new Set(JSON.parse(s)))
    if (d) setDeselectedIds(new Set(JSON.parse(d)))
    if (g) setGlobalSelectCount(Number(g) || 0)
    loadPage(1)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_SELECTED, JSON.stringify(Array.from(selectedIds)))
  }, [selectedIds])

  useEffect(() => {
    localStorage.setItem(STORAGE_DESELECTED, JSON.stringify(Array.from(deselectedIds)))
  }, [deselectedIds])

  useEffect(() => {
    localStorage.setItem(STORAGE_GLOBAL, String(globalSelectCount))
  }, [globalSelectCount])

  // Fetch page data
  const loadPage = useCallback(async (pageToLoad: number) => {
    setLoading(true)
    try {
      const res = await fetchArtworks(pageToLoad)
      const artworks = res.data.map((a: ArtworkApiResponse) => ({
        id: a.id,
        title: a.title,
        place_of_origin: a.place_of_origin,
        artist_display: a.artist_display,
        inscriptions: a.inscription || a.inscriptions || null,
        date_start: a.date_start,
        date_end: a.date_end
      })) as Artwork[]
      setData(artworks)
      setPage(pageToLoad)

      if (res.pagination?.limit) setPerPage(res.pagination.limit)
      if (res.pagination?.total_pages) setTotalPages(res.pagination.total_pages)
      else if (res.pagination?.total) {
        setTotalPages(Math.ceil(res.pagination.total / (res.pagination.limit || artworks.length)))
      }

      const selectedRows = calcSelCurPage(artworks, pageToLoad)
      setLocalSelectedRows(selectedRows)
    } catch (err) {
      console.error('Failed to fetch', err)
    } finally {
      setLoading(false)
    }
  }, [selectedIds, deselectedIds, globalSelectCount])

  // Compute selected rows for current page
  const calcSelCurPage = (rows: Artwork[], pageNum: number) => {
    const sel: Artwork[] = []
    for (let i = 0; i < rows.length; i++) {
      const globalIndex = (pageNum - 1) * perPage + (i + 1)
      const row = rows[i]
      if (selectedIds.has(row.id)) sel.push(row)
      else if (!deselectedIds.has(row.id) && globalSelectCount > 0 && globalIndex <= globalSelectCount) sel.push(row)
    }
    return sel
  }

  // Handle selection change
  const onSelectionChange = (e: { value: Artwork[] }) => {
    const prevSelectedIds = new Set(localSelectedRows.map(r => r.id))
    const newSelectedIds = new Set(e.value.map(r => r.id))
    const delta = newSelectedIds.size - prevSelectedIds.size
    setGlobalSelectCount(prev => Math.max(0, prev + delta))

    const newSel = new Set(selectedIds)
    const newDesel = new Set(deselectedIds)

    for (const row of data) {
      if (newSelectedIds.has(row.id)) {
        newSel.add(row.id)
        newDesel.delete(row.id)
      } else {
        newSel.delete(row.id)
        newDesel.add(row.id)
      }
    }

    setSelectedIds(newSel)
    setDeselectedIds(newDesel)
    setLocalSelectedRows(e.value)
  }

  const onPageChange = (newPage: number) => loadPage(newPage)

  // Table header with tick overlay
  const tableHeader = (
    <div className="p-d-flex p-ai-center">
      <Button
        icon="pi pi-check"
        onClick={(e) => op.current?.toggle(e)}
        label={`${globalSelectCount}`}
        className="p-ml-2"
      />
      <OverlayPanel ref={op}>
        <div style={{ width: 220 }}>
          <p style={{ marginTop: 0 }}>Set how many rows should be selected across the dataset.</p>
          <InputNumber
            value={globalSelectCount}
            onValueChange={(e) => setGlobalSelectCount(Number(e.value) || 0)}
            showButtons
            min={0}
            max={100000}
          />
          <div style={{ marginTop: 8 }}>
            <Button
              label="Submit"
              onClick={() => {
                op.current?.hide()
                const selectedRows = calcSelCurPage(data, page)
                setLocalSelectedRows(selectedRows)
              }}
            />
          </div>
        </div>
      </OverlayPanel>
    </div>
  )

  return (
    <div className="card">
      <DataTable
        value={data}
        header={tableHeader}
        lazy
        paginator
        first={(page - 1) * perPage}
        rows={perPage}
        totalRecords={totalPages ? totalPages * perPage : undefined}
        paginatorLeft={null}
        paginatorRight={null}
        onPage={(e) => onPageChange((e.page ?? 0) + 1)}
        selectionMode="checkbox"
        selection={localSelectedRows}
        onSelectionChange={onSelectionChange}
        dataKey="id"
        loading={loading}
        tableStyle={{ minWidth: '50rem' }}
      >
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
        <Column field="title" header="Title" sortable />
        <Column field="place_of_origin" header="Place" />
        <Column field="artist_display" header="Artist" />
        <Column field="inscriptions" header="Inscriptions" />
        <Column field="date_start" header="Date Start" />
        <Column field="date_end" header="Date End" />
      </DataTable>

      <div className="p-mt-3">
        <h4>Selection summary</h4>
        <p>Selected IDs: {Array.from(selectedIds).slice(0, 50).join(', ') || '(none)'}</p>
        <p>Deselected IDs: {Array.from(deselectedIds).slice(0, 50).join(', ') || '(none)'}</p>
        <p>Global select count: {globalSelectCount}</p>
        <p>
          NOTE: Only IDs for selected/deselected rows and a numeric global count are persisted in localStorage.
        </p>
      </div>
    </div>
  )
}
