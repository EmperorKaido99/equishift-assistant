import React, { useState } from 'react';
import { useSchedule } from '@/hooks/useSchedule';
import MonthSelector from '@/components/MonthSelector';
import DraggableScheduleList from '@/components/DraggableScheduleList';
import ChatPanel from '@/components/ChatPanel';
import StaffStatsBar from '@/components/StaffStatsBar';
import StaffLegend from '@/components/StaffLegend';
import SchedulePrompt from '@/components/SchedulePrompt';
import PrintableTable from '@/components/PrintableTable';
import { Printer, Calendar, MessageCircle, ArrowLeft, Palette } from 'lucide-react';

const Index: React.FC = () => {
  const {
    year, setYear,
    month, setMonth,
    schedule,
    messages,
    highlightDays,
    stats,
    isAiLoading,
    generate,
    sendMessage,
    resetSchedule,
    swapStaff,
  } = useSchedule();

  const [mobileTab, setMobileTab] = useState<'schedule' | 'chat'>('schedule');
  const [printInColor, setPrintInColor] = useState(true);

  const handlePrint = () => {
    document.documentElement.setAttribute('data-print-color', printInColor ? 'true' : 'false');
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="no-print sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              {schedule && (
                <button
                  onClick={resetSchedule}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground transition-colors mr-1"
                  title="Back to settings"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                E
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-tight">EquiShift</h1>
                <p className="text-xs text-muted-foreground">Fair shift scheduling</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MonthSelector
                year={year}
                month={month}
                onYearChange={setYear}
                onMonthChange={setMonth}
              />
              {schedule && (
                <>
                  <button
                    onClick={() => setPrintInColor(prev => !prev)}
                    className={`rounded-lg border p-2 transition-colors ${
                      printInColor
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                    title={printInColor ? 'Print in colour' : 'Print black & white'}
                  >
                    <Palette className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handlePrint}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground transition-colors"
                    title="Print schedule"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      {schedule && (
        <div className="no-print lg:hidden sticky top-[73px] z-10 border-b border-border bg-card">
          <div className="flex">
            <button
              onClick={() => setMobileTab('schedule')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                mobileTab === 'schedule'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </button>
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                mobileTab === 'chat'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-4">
        {!schedule ? (
          <div className="py-8 animate-fade-in">
            <div className="text-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4 mx-auto">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">Welcome to EquiShift</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Select a month above, choose your shift pattern, and generate a fair schedule.
              </p>
            </div>
            <SchedulePrompt onGenerate={generate} />
          </div>
        ) : (
          <>
            {/* Screen view */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Schedule Panel */}
              <div className={`flex-1 min-w-0 ${mobileTab !== 'schedule' ? 'hidden lg:block' : ''}`}>
                <StaffLegend />
                <div className="mt-3">
                  <StaffStatsBar stats={stats} />
                </div>
                <div className="mt-3">
                  <DraggableScheduleList
                    schedule={schedule}
                    highlightDays={highlightDays}
                    onSwap={(dayIndex, nameA, shiftA, nameB, shiftB) => {
                      swapStaff(dayIndex, nameA, shiftA, nameB, shiftB);
                    }}
                  />
                </div>
              </div>

              {/* Chat Panel */}
              <div className={`lg:w-96 lg:sticky lg:top-[73px] lg:h-[calc(100vh-89px)] ${mobileTab !== 'chat' ? 'hidden lg:block' : 'h-[calc(100vh-130px)]'}`}>
                <ChatPanel
                  messages={messages}
                  onSend={sendMessage}
                  disabled={!schedule}
                  isLoading={isAiLoading}
                />
              </div>
            </div>

            {/* Print-only table */}
            <PrintableTable schedule={schedule} colorMode={printInColor} />
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
