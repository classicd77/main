import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Bell, Search, Wallet, Landmark, Globe, ShieldCheck, TrendingUp, FileText, ArrowUpRight, ArrowDownRight, CalendarClock, Filter, Download, UserCircle2, Building2 } from 'lucide-react';

const portfolioAllocation = [
  { name: 'מניות', value: 34 },
  { name: 'אג"ח', value: 18 },
  { name: 'נדל"ן', value: 27 },
  { name: 'מזומן', value: 9 },
  { name: 'אלטרנטיבי', value: 12 },
];

const geoExposure = [
  { region: 'ישראל', value: 39 },
  { region: 'ארה"ב', value: 31 },
  { region: 'אירופה', value: 18 },
  { region: 'אסיה', value: 7 },
  { region: 'אחר', value: 5 },
];

const performanceSeries = [
  { month: 'ינו', value: 12.3 },
  { month: 'פבר', value: 12.5 },
  { month: 'מרץ', value: 12.9 },
  { month: 'אפר', value: 13.0 },
  { month: 'מאי', value: 13.4 },
  { month: 'יונ', value: 13.8 },
  { month: 'יול', value: 14.1 },
  { month: 'אוג', value: 14.0 },
  { month: 'ספט', value: 14.4 },
  { month: 'אוק', value: 14.8 },
  { month: 'נוב', value: 15.2 },
  { month: 'דצ', value: 15.6 },
];

const upcomingActions = [
  {
    title: 'בחינת הגדלת חשיפה גלובלית',
    owner: 'מנהל עושר',
    due: '12/04/2026',
    priority: 'גבוה',
  },
  {
    title: 'עדכון מסמכי נאמנות משפחתית',
    owner: 'יועץ משפטי',
    due: '18/04/2026',
    priority: 'בינוני',
  },
  {
    title: 'בדיקת מינוף נדל"ן בחו"ל',
    owner: 'אנליסט',
    due: '25/04/2026',
    priority: 'גבוה',
  },
];

const holdings = [
  { asset: 'תיק ניירות ערך גלובלי', type: 'סחיר', marketValue: '₪4,250,000', change: '+6.8%' },
  { asset: 'נדל"ן מניב תל אביב', type: 'פיזי', marketValue: '₪3,900,000', change: '+2.1%' },
  { asset: 'אג"ח קונצרני ודירוג גבוה', type: 'סחיר', marketValue: '₪1,850,000', change: '+1.9%' },
  { asset: 'קרן השקעות פרטיות', type: 'אלטרנטיבי', marketValue: '₪1,300,000', change: '+7.5%' },
  { asset: 'פיקדון נזיל', type: 'נזיל', marketValue: '₪980,000', change: '+0.4%' },
];

const clientDocuments = [
  { name: 'דוח עושר רבעוני', date: '31/03/2026', tag: 'PDF' },
  { name: 'המלצת הקצאת נכסים', date: '30/03/2026', tag: 'Signed' },
  { name: 'סיכום פגישה משפחתית', date: '20/03/2026', tag: 'Internal' },
];

const colors = ['#0f172a', '#1d4ed8', '#64748b', '#0ea5e9', '#94a3b8'];

const statCards = [
  {
    title: 'שווי נכסים כולל',
    value: '₪12,280,000',
    delta: '+4.2% YTD',
    icon: Wallet,
  },
  {
    title: 'עושר נטו',
    value: '₪10,940,000',
    delta: '+₪440K רבעוני',
    icon: Landmark,
  },
  {
    title: 'נכסים בחו"ל',
    value: '41%',
    delta: 'יעד: 48%',
    icon: Globe,
  },
  {
    title: 'ציון עמידה ביעדים',
    value: '82/100',
    delta: 'במגמת שיפור',
    icon: ShieldCheck,
  },
];

function DeltaPill({ value }) {
  const positive = value.trim().startsWith('+');
  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      <span>{value}</span>
    </div>
  );
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default function PremiumClientDashboard() {
  const [search, setSearch] = useState('');
  const [selectedClient] = useState('משפחת כהן');

  const filteredHoldings = useMemo(() => {
    return holdings.filter((h) => h.asset.includes(search) || h.type.includes(search));
  }, [search]);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 grid gap-4 lg:grid-cols-[1.45fr_0.8fr]"
        >
          <Card className="rounded-2xl border-0 bg-gradient-to-l from-slate-900 via-slate-800 to-blue-900 text-white shadow-xl">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                      <UserCircle2 className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-200">דשבורד לקוח פרימיום</p>
                      <h1 className="text-2xl font-bold md:text-3xl">{selectedClient}</h1>
                    </div>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
                    תמונת עושר הוליסטית, המלצות פעולה ממוקדות, ניתוח פיזור נכסים, מסמכים עדכניים ומעקב שוטף אחר ביצועי ההון המשפחתי.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/10">Tier A</Badge>
                    <Badge className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-100 hover:bg-emerald-500/20">כשיר להשקעות גלובליות</Badge>
                    <Badge className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100 hover:bg-sky-500/20">סקירה חודשית פעילה</Badge>
                  </div>
                </div>

                <div className="grid min-w-[240px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <div className="text-sm text-slate-200">מנהל תיק</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                      <Building2 className="h-4 w-4" />
                      Daniel Polad
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <div className="text-sm text-slate-200">פגישה קרובה</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                      <CalendarClock className="h-4 w-4" />
                      14/04/2026 · 11:00
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">התראות ועדכונים</p>
                  <h2 className="text-xl font-semibold">מוקדי תשומת לב</h2>
                </div>
                <div className="rounded-full bg-slate-100 p-2">
                  <Bell className="h-5 w-5 text-slate-700" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-900">ריכוזיות נדל"ן בישראל</div>
                  <p className="mt-1 text-sm text-amber-800">חשיפה של 27% בנכסי נדל"ן מקומיים. מומלץ לבחון איזון מול רכיבים גלובליים סחירים.</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="text-sm font-semibold text-sky-900">עודף מזומן לא מוקצה</div>
                  <p className="mt-1 text-sm text-sky-800">קיימת יתרת נזילות גבוהה יחסית ליעד. ניתן לבחון פריסת השקעה בשלבים.</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-semibold text-emerald-900">עמידה ביעדי תשואה</div>
                  <p className="mt-1 text-sm text-emerald-800">הלקוח מעל קו היעד השנתי. מומלץ לשמר מסגרת סיכון נשלטת.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-500">{item.title}</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
                        <p className="mt-2 text-sm text-slate-500">{item.delta}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-100 p-3">
                        <Icon className="h-5 w-5 text-slate-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="h-auto rounded-2xl bg-white p-1 shadow-sm">
              <TabsTrigger value="overview" className="rounded-xl px-4 py-2">סקירה כללית</TabsTrigger>
              <TabsTrigger value="portfolio" className="rounded-xl px-4 py-2">תיק נכסים</TabsTrigger>
              <TabsTrigger value="actions" className="rounded-xl px-4 py-2">פעולות והמלצות</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-xl px-4 py-2">מסמכים</TabsTrigger>
            </TabsList>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש נכס או קטגוריה"
                  className="rounded-2xl border-slate-200 pr-10"
                />
              </div>
              <Button variant="outline" className="rounded-2xl gap-2">
                <Filter className="h-4 w-4" />
                סינון מתקדם
              </Button>
              <Button className="rounded-2xl gap-2 bg-slate-900 hover:bg-slate-800">
                <Download className="h-4 w-4" />
                ייצוא דוח
              </Button>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <SectionTitle title="מגמת שווי נכסים" subtitle="התפתחות תיק ההון ב־12 החודשים האחרונים" />
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceSeries}>
                      <defs>
                        <linearGradient id="wealthFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" />
                      <YAxis unit="M" />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" stroke="#1d4ed8" fill="url(#wealthFill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-6">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardHeader>
                    <SectionTitle title="חלוקת נכסים" subtitle="מצב נוכחי לפי סוג נכס" />
                  </CardHeader>
                  <CardContent className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
                    <div className="mx-auto h-[220px] w-full max-w-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={portfolioAllocation} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                            {portfolioAllocation.map((entry, index) => (
                              <Cell key={entry.name} fill={colors[index % colors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {portfolioAllocation.map((item, index) => (
                        <div key={item.name} className="rounded-2xl bg-slate-50 p-3">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                              <span className="font-medium text-slate-700">{item.name}</span>
                            </div>
                            <span className="font-semibold text-slate-900">{item.value}%</span>
                          </div>
                          <Progress value={item.value} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <SectionTitle title="ציון כשירות תיק" subtitle="הערכת איכות מבנה ההון וניהול הסיכונים" />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-4 text-center">
                        <div className="text-2xl font-bold text-slate-900">78</div>
                        <div className="mt-1 text-sm text-slate-500">פיזור</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 text-center">
                        <div className="text-2xl font-bold text-slate-900">85</div>
                        <div className="mt-1 text-sm text-slate-500">נזילות</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 text-center">
                        <div className="text-2xl font-bold text-slate-900">83</div>
                        <div className="mt-1 text-sm text-slate-500">שליטה בסיכון</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <SectionTitle title="פיזור גיאוגרפי" subtitle="חשיפה לפי אזורים ושווקים" />
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={geoExposure}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="region" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#0f172a" name="חשיפה %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <SectionTitle title="רשימת נכסים" subtitle="נכסים מרכזיים בתיק המשפחתי" />
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                      <div className="col-span-5">נכס</div>
                      <div className="col-span-2">סוג</div>
                      <div className="col-span-3">שווי שוק</div>
                      <div className="col-span-2">שינוי</div>
                    </div>
                    {filteredHoldings.map((row) => (
                      <div key={row.asset} className="grid grid-cols-12 items-center border-t border-slate-100 px-4 py-4 text-sm">
                        <div className="col-span-5 font-medium text-slate-900">{row.asset}</div>
                        <div className="col-span-2 text-slate-600">{row.type}</div>
                        <div className="col-span-3 font-semibold text-slate-900">{row.marketValue}</div>
                        <div className="col-span-2"><DeltaPill value={row.change} /></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <SectionTitle title="פעולות פתוחות" subtitle="צעדים מומלצים להמשך טיפול" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {upcomingActions.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-sm text-slate-500">אחראי: {item.owner}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full">{item.due}</Badge>
                          <Badge className={`rounded-full ${item.priority === 'גבוה' ? 'bg-rose-600' : 'bg-amber-500'}`}>{item.priority}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <SectionTitle title="המלצה אסטרטגית" subtitle="טיוטת המלצה מוכנה להצגה ללקוח" action={<Button className="rounded-2xl bg-slate-900 hover:bg-slate-800">צור דוח</Button>} />
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-7 text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    מומלץ להגדיל בהדרגה חשיפה לשווקים גלובליים באמצעות רכיבים סחירים, לצמצם ריכוזיות בנדל"ן מקומי, ולשמר שכבת נזילות שתאפשר הזדמנויות והשקעות משפחתיות עתידיות.
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                        <TrendingUp className="h-4 w-4" />
                        צעדי צמיחה
                      </div>
                      <p>הגדלת רכיב ETF גלובלי ורכיב הכנסה איכותי לטווח בינוני.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                        <ShieldCheck className="h-4 w-4" />
                        צעדי הגנה
                      </div>
                      <p>שמירה על נזילות מינימלית של 8% ובקרת חשיפה מטבעית שוטפת.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <SectionTitle title="מסמכים אחרונים" subtitle="דוחות, המלצות וסיכומי פגישות" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {clientDocuments.map((doc) => (
                    <div key={doc.name} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-slate-100 p-2">
                          <FileText className="h-4 w-4 text-slate-700" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{doc.name}</div>
                          <div className="mt-1 text-sm text-slate-500">{doc.date}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="rounded-full">{doc.tag}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <SectionTitle title="מרכז לקוח" subtitle="תצוגת שירות ברמה של Private Banking" />
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      ['סקירה תקופתית', 'הדוח הרבעוני האחרון זמין לצפייה ולהדפסה'],
                      ['מסמכים לחתימה', '2 מסמכים מחכים לאישור דיגיטלי'],
                      ['פגישות ויומן', 'פגישה אסטרטגית נקבעה לאפריל'],
                      ['רשימת משימות', 'מעקב אחר 3 פעולות פתוחות'],
                      ['סיכום משפחתי', 'צפייה מרוכזת בנכסים לפי בני משפחה'],
                      ['התאמת סיכון', 'שאלון עדכון התאמה מומלץ לרבעון הבא'],
                    ].map(([title, subtitle]) => (
                      <motion.div
                        key={title}
                        whileHover={{ y: -3 }}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="font-semibold text-slate-900">{title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
