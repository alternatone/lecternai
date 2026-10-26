/**
 * Sample seminary course data for demo mode.
 *
 * Rows are in database (snake_case) form, matching schema.sql.
 * Unlock dates are relative to today so the demo always shows
 * a mix of open and locked weeks.
 */

export const DEMO_ACCOUNTS = {
    admin: { id: 'demo-admin', email: 'admin@demo.lectern', name: 'Fr. Thomas Reilly' },
    student: { id: 'demo-student', email: 'student@demo.lectern', name: 'Jordan Ellis' }
}

const CLASSMATES = [
    { id: 'demo-student-2', email: 'maria@demo.lectern', name: 'Maria Okafor' },
    { id: 'demo-student-3', email: 'daniel@demo.lectern', name: 'Daniel Brennan' }
]

const MODULES = [
    {
        title: 'Introduction to Thomistic Philosophy',
        description: 'A foundational course in the philosophical framework of St. Thomas Aquinas: metaphysics, epistemology, and natural theology.',
        instructor: 'Fr. Thomas Reilly, O.P.',
        duration: '3 weeks',
        participation: 'Post a response to each discussion question and reply to at least two classmates.',
        time_expectations: 'Plan on 3–4 hours per week for readings, videos, and discussion.',
        zoom: { day: 'Wednesday', time: '19:00' },
        weeks: [
            {
                title: 'Faith and Reason',
                description: 'Why Aquinas thought theology could be a science, and what reason can know about God on its own.',
                opening: 'What do you think the relationship between faith and reason is? Can they ever truly conflict?',
                intro: 'Aquinas opens the Summa by asking whether we need any knowledge beyond philosophy. His answer — yes, but not because reason is worthless — sets the tone for everything that follows. This week we look at how he divides the work between natural reason and revealed truth.',
                video: 'Aquinas faith and reason lecture',
                readings: [
                    { title: 'Summa Theologiae I, Q. 1 — The Nature and Extent of Sacred Doctrine', url: 'https://www.newadvent.org/summa/1001.htm', description: 'Read articles 1, 2, and 8.' }
                ],
                zoomPrep: 'Come ready to explain, in your own words, why Aquinas calls sacred doctrine a science. Bring one objection you find persuasive.',
                reflection: ['After our session, has your view of how faith and reason relate changed? Why or why not?'],
                further: [{ title: 'Fides et Ratio (John Paul II, 1998)', url: 'https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_14091998_fides-et-ratio.html', description: 'Encyclical on the relationship between faith and reason.' }]
            },
            {
                title: 'The Five Ways',
                description: 'Aquinas’s five arguments for the existence of God from the Summa Theologiae.',
                opening: 'Before reading: what arguments for God’s existence have you encountered, and which have you found convincing?',
                intro: 'The Five Ways are among the most discussed arguments in the history of philosophy — and among the most misunderstood. Each begins from something we observe (motion, causation, contingency, gradation, order) and reasons to a first principle.',
                video: 'Aquinas five ways explained',
                readings: [
                    { title: 'Summa Theologiae I, Q. 2 — The Existence of God', url: 'https://www.newadvent.org/summa/1002.htm', description: 'Article 3 contains the Five Ways.' }
                ],
                zoomPrep: 'Pick one of the Five Ways and be prepared to state its premises clearly. We will test each against common objections.',
                reflection: ['Which of the Five Ways do you find most compelling, and which raises the most questions for you?', 'How would you explain the First Way to a friend with no background in philosophy?'],
                further: [{ title: 'Summa Theologiae I, Q. 3 — The Simplicity of God', url: 'https://www.newadvent.org/summa/1003.htm', description: 'What follows from the Five Ways about what God is (and is not).' }]
            },
            {
                title: 'How We Name God',
                description: 'Analogy, negation, and the limits of language about the divine.',
                opening: 'When we call God “good,” do we mean the same thing as when we call a person good?',
                intro: 'If God is utterly simple and beyond our concepts, how can we say anything true about him? Aquinas’s doctrine of analogy is his answer — a middle path between saying our words mean exactly the same thing and saying they mean nothing at all.',
                video: 'Aquinas analogy divine names',
                readings: [
                    { title: 'Summa Theologiae I, Q. 13 — The Names of God', url: 'https://www.newadvent.org/summa/1013.htm', description: 'Focus on articles 2, 3, and 5.' }
                ],
                zoomPrep: 'Write down one example each of univocal, equivocal, and analogical language.',
                reflection: ['How does the doctrine of analogy shape the way you might preach or pray?'],
                further: [{ title: 'Summa Theologiae I, Q. 12 — How God Is Known by Us', url: 'https://www.newadvent.org/summa/1012.htm', description: 'The epistemology behind the divine names.' }]
            }
        ]
    },
    {
        title: 'Foundations of Sacred Scripture',
        description: 'An introduction to the inspiration, interpretation, and canon of Scripture in the Catholic tradition.',
        instructor: 'Dr. Anne Whitfield',
        duration: '2 weeks',
        participation: 'Weekly discussion posts and one short exegesis exercise.',
        time_expectations: 'Plan on 2–3 hours per week.',
        zoom: { day: 'Monday', time: '18:30' },
        weeks: [
            {
                title: 'Revelation and Inspiration',
                description: 'What the Church means when it calls Scripture the Word of God.',
                opening: 'What does it mean to you that Scripture is “inspired”?',
                intro: 'Dei Verbum describes Scripture as truly the word of God and truly the work of human authors. This week we look at how the Council held those two claims together.',
                video: 'Dei Verbum explained',
                readings: [
                    { title: 'Dei Verbum (Second Vatican Council, 1965)', url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html', description: 'Read chapters 1–3.' }
                ],
                zoomPrep: 'Note one passage from Dei Verbum that surprised you and one you would like clarified.',
                reflection: ['How does the human authorship of Scripture affect how you read it?'],
                further: [{ title: 'Catechism of the Catholic Church', url: 'https://www.vatican.va/archive/ENG0015/_INDEX.HTM', description: 'See paragraphs 101–141 on Sacred Scripture.' }]
            },
            {
                title: 'The Senses of Scripture',
                description: 'Literal and spiritual senses, from the Fathers to the present.',
                opening: 'Have you ever read a passage of Scripture that seemed to mean more than one thing at once?',
                intro: 'The tradition distinguishes the literal sense from three spiritual senses — allegorical, moral, and anagogical. Aquinas argues that all of them rest on the literal sense, a point we will test against patristic readings.',
                video: 'four senses of scripture',
                readings: [
                    { title: 'Summa Theologiae I, Q. 1, Art. 10', url: 'https://www.newadvent.org/summa/1001.htm#article10', description: 'Whether one passage of Scripture can have several senses.' }
                ],
                zoomPrep: 'Choose a short Gospel passage and try reading it in each of the four senses.',
                reflection: ['Which of the four senses do you find most natural, and which most challenging?'],
                further: [{ title: 'Augustine, Confessions', url: 'https://www.newadvent.org/fathers/1101.htm', description: 'Books 12–13 show Augustine wrestling with the meaning of Genesis.' }]
            }
        ]
    }
]

const SAMPLE_POSTS = [
    { author: 'demo-student-2', content: 'I came in assuming faith picks up where reason gives out, but Aquinas seems to think they overlap — some truths (like God’s existence) can be known both ways.' },
    { author: 'demo-student-3', content: 'What strikes me is how much he trusts reason. That feels almost countercultural now.', replyTo: 0 },
    { author: 'demo-admin', content: 'Good observation, Daniel. Hold onto that — it will matter when we get to the Five Ways next week.', replyTo: 1 }
]

function isoDate(daysFromToday) {
    const d = new Date()
    d.setDate(d.getDate() + daysFromToday)
    return d.toISOString().split('T')[0]
}

function ytSearch(query) {
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query)
}

/** Returns { tableName: [rows] } with explicit ids so rows can reference each other. */
export function buildDemoData() {
    const data = {
        users: [], modules: [], module_zoom_info: [], weeks: [], pages: [],
        questions: [], resources: [], videos: [], enrollments: [], progress: [], discussion_posts: []
    }
    const ids = {}
    const nextId = table => (ids[table] = (ids[table] || 0) + 1)

    const { admin, student } = DEMO_ACCOUNTS
    data.users.push({ ...admin, role: 'admin', status: 'active' })
    data.users.push({ ...student, role: 'student', status: 'active' })
    for (const c of CLASSMATES) data.users.push({ ...c, role: 'student', status: 'active' })
    data.users.push({ id: 'demo-pending', email: 'new.applicant@demo.lectern', name: 'Sam Patel', role: 'student', status: 'pending' })

    const addModule = (mod, status, templateId = null) => {
        const id = nextId('modules')
        data.modules.push({
            id,
            title: mod.title,
            description: mod.description,
            instructor: mod.instructor,
            duration: mod.duration,
            participation: mod.participation,
            time_expectations: mod.time_expectations,
            status,
            template_id: templateId,
            launched_at: status === 'launched' ? new Date().toISOString() : null
        })
        data.module_zoom_info.push({
            id: nextId('module_zoom_info'),
            module_id: id,
            url: 'https://zoom.us/j/0000000000',
            meeting_id: '000 000 0000',
            passcode: 'demo',
            ...mod.zoom,
            timezone: 'EST'
        })

        mod.weeks.forEach((w, i) => {
            const weekId = nextId('weeks')
            // First two weeks open; later weeks unlock a week apart in the future
            const unlock = i < 2 ? isoDate(-14 + i * 7) : isoDate((i - 1) * 7)
            data.weeks.push({ id: weekId, module_id: id, week_number: i + 1, title: w.title, description: w.description, unlock_date: unlock })

            const page = (title, type, content = null) => {
                const pageId = nextId('pages')
                data.pages.push({ id: pageId, week_id: weekId, page_number: data.pages.filter(p => p.week_id === weekId).length + 1, title, type, content })
                return pageId
            }
            const question = (pageId, text, n) => {
                const qId = nextId('questions')
                data.questions.push({ id: qId, page_id: pageId, question_number: n, text })
                return qId
            }
            const resource = (pageId, r, n) => data.resources.push({ id: nextId('resources'), page_id: pageId, sort_order: n, ...r })

            // Fixed 6-page structure used by the week editor
            const p1 = page('Opening Reflection Question', 'discussion')
            const openingQ = question(p1, w.opening, 1)
            const p2 = page('Introduction to the Week', 'intro', w.intro)
            data.videos.push({ id: nextId('videos'), page_id: p2, title: 'Lecture: ' + w.title, url: ytSearch(w.video), duration: '15:00', sort_order: 0 })
            const p3 = page('Weekly Reading', 'reading')
            w.readings.forEach((r, n) => resource(p3, r, n))
            page('Preparation for Zoom Session', 'intro', w.zoomPrep)
            const p5 = page('Post-Zoom Reflection', 'discussion')
            w.reflection.forEach((text, n) => question(p5, text, n + 1))
            const p6 = page('Further Study', 'reading')
            w.further.forEach((r, n) => resource(p6, r, n))

            // Seed a conversation on the first live module's opening question
            if (status === 'launched' && templateId && i === 0) {
                const postIds = []
                SAMPLE_POSTS.forEach((post, n) => {
                    const postId = nextId('discussion_posts')
                    postIds.push(postId)
                    const created = new Date(Date.now() - (SAMPLE_POSTS.length - n) * 3600 * 1000).toISOString()
                    data.discussion_posts.push({
                        id: postId,
                        question_id: openingQ,
                        user_id: post.author,
                        parent_id: post.replyTo === undefined ? null : postIds[post.replyTo],
                        content: post.content,
                        created_at: created,
                        updated_at: created
                    })
                })
                data.progress.push({ id: nextId('progress'), user_id: student.id, week_id: weekId, current_page: 6, completed: true, completed_at: new Date().toISOString() })
            }
        })
        return id
    }

    // Thomistic Philosophy: a draft template plus a launched section copied from it
    const templateId = addModule(MODULES[0], 'draft')
    const launched = [addModule(MODULES[0], 'launched', templateId), addModule(MODULES[1], 'launched')]

    for (const moduleId of launched) {
        for (const u of [student, ...CLASSMATES]) {
            data.enrollments.push({ id: nextId('enrollments'), user_id: u.id, module_id: moduleId })
        }
    }
    return data
}
