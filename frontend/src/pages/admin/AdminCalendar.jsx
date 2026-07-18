import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { calendarApi } from "@/lib/api";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Link2, MapPin, Pencil, X } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SWATCHES = ["#6366F1", "#3B82F6", "#14B8A6", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#EC4899"];

export default function AdminCalendar() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["admin-calendar"], queryFn: calendarApi.get });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-calendar"] });

  const deleteEvent = useMutation({
    mutationFn: (id) => calendarApi.removeEvent(id),
    onSuccess: () => {
      toast.success("Event deleted");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to delete"),
  });

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of data?.events || []) {
      (map[ev.date] ||= []).push(ev);
    }
    return map;
  }, [data]);

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  const openDay = (dateStr) => {
    setSelectedDate(dateStr);
    setEditingEvent(null);
    setFormOpen(false);
  };

  return (
    <div data-testid="admin-calendar-page" className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-[-0.02em]">{format(month, "MMMM yyyy")}</h2>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              data-testid="calendar-prev-month"
              className="rounded-full p-1.5 hover:bg-[#F7F5F2]"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              data-testid="calendar-next-month"
              className="rounded-full p-1.5 hover:bg-[#F7F5F2]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-[#8A8588]">Loading…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-[#8A8588] pb-1">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDate[dateStr] || [];
              const inMonth = isSameMonth(day, month);
              const today = isToday(day);
              return (
                <button
                  type="button"
                  key={dateStr}
                  onClick={() => openDay(dateStr)}
                  data-testid={`calendar-day-${dateStr}`}
                  className={`min-h-[76px] rounded-[10px] border p-1.5 text-left align-top transition-colors ${
                    selectedDate === dateStr
                      ? "border-[#FF6B35] bg-[#FF6B35]/5"
                      : "border-[rgba(26,26,26,0.06)] hover:border-[rgba(26,26,26,0.15)]"
                  } ${inMonth ? "" : "opacity-35"}`}
                >
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      today ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1A] text-white" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className="truncate rounded-[4px] px-1 py-0.5 text-[9px] font-semibold text-white"
                        style={{ backgroundColor: ev.color }}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] font-semibold text-[#8A8588]">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5 h-fit">
        {!selectedDate ? (
          <p className="text-sm text-[#8A8588]">Click a day to see or add events.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold tracking-[-0.01em]">
                {format(parseISO(selectedDate), "EEEE, MMM d")}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingEvent(null);
                  setFormOpen((f) => !f);
                }}
                data-testid="calendar-add-event-btn"
                className="btn-primary !px-3 !py-1.5 text-xs"
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {formOpen && (
              <EventForm
                date={selectedDate}
                initial={editingEvent}
                onDone={() => {
                  setFormOpen(false);
                  setEditingEvent(null);
                  invalidate();
                }}
              />
            )}

            {selectedEvents.length === 0 && !formOpen ? (
              <p className="text-xs text-[#8A8588]">No events this day.</p>
            ) : (
              <div className="space-y-2.5">
                {selectedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    data-testid={`calendar-event-${ev.id}`}
                    className="rounded-[12px] border border-[rgba(26,26,26,0.08)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                        <p className="text-xs font-bold">{ev.title}</p>
                      </div>
                      {ev.type === "custom" && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent(ev);
                              setFormOpen(true);
                            }}
                            data-testid={`calendar-event-edit-${ev.id}`}
                            className="rounded-full p-1 text-[#8A8588] hover:bg-[#F7F5F2] hover:text-[#1A1A1A]"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEvent.mutate(ev.id)}
                            disabled={deleteEvent.isPending}
                            data-testid={`calendar-event-delete-${ev.id}`}
                            className="rounded-full p-1 text-[#8A8588] hover:bg-red-50 hover:text-[#EF4444]"
                          >
                            {deleteEvent.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      )}
                    </div>
                    {ev.time && <p className="mt-1 text-[10px] text-[#8A8588]">{ev.time}</p>}
                    {ev.description && <p className="mt-1 text-xs text-[#1A1A1A]/70">{ev.description}</p>}
                    {ev.location && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-[#8A8588]">
                        <MapPin size={10} /> {ev.location}
                      </p>
                    )}
                    {ev.link && (
                      <a
                        href={ev.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#FF6B35] underline"
                      >
                        <Link2 size={10} /> Open link
                      </a>
                    )}
                    {ev.type === "deadline" && (
                      <p className="mt-1 text-[10px] italic text-[#8A8588]">Set via Orders tab</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EventForm({ date, initial, onDone }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [time, setTime] = useState(initial?.time || "");
  const [color, setColor] = useState(initial?.color || SWATCHES[0]);
  const [description, setDescription] = useState(initial?.description || "");
  const [link, setLink] = useState(initial?.link || "");
  const [location, setLocation] = useState(initial?.location || "");

  const save = useMutation({
    mutationFn: () => {
      const payload = { title: title.trim(), date, time: time || null, color, description: description.trim() || null, link: link.trim() || null, location: location.trim() || null };
      return initial ? calendarApi.updateEvent(initial.id, payload) : calendarApi.createEvent(payload);
    },
    onSuccess: () => {
      toast.success(initial ? "Event updated" : "Event added");
      onDone();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to save"),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    save.mutate();
  };

  return (
    <form onSubmit={submit} data-testid="calendar-event-form" className="mb-3 space-y-2 rounded-[12px] border-2 border-[#FF6B35]/30 p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event title"
        data-testid="calendar-event-title-input"
        className="input-base text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          data-testid="calendar-event-time-input"
          className="input-base text-sm"
        />
        <div className="flex items-center gap-1">
          {SWATCHES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              data-testid={`calendar-event-color-${c}`}
              className={`h-6 w-6 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-[#1A1A1A]" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        data-testid="calendar-event-description-input"
        className="input-base text-sm resize-y"
      />
      <input
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Link (optional)"
        data-testid="calendar-event-link-input"
        className="input-base text-sm"
      />
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
        data-testid="calendar-event-location-input"
        className="input-base text-sm"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={save.isPending} data-testid="calendar-event-save-btn" className="btn-primary !py-1.5 !px-3 text-xs">
          {save.isPending ? <Loader2 size={13} className="animate-spin" /> : initial ? "Save changes" : "Add event"}
        </button>
        <button type="button" onClick={onDone} data-testid="calendar-event-cancel-btn" className="btn-secondary !py-1.5 !px-3 text-xs">
          <X size={13} /> Cancel
        </button>
      </div>
    </form>
  );
}
