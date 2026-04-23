app.post('/api/onboarding', async (c) => {
  try {
    const body = (await c.req.json()) as AthleteProfileInput

    validateProfile(body)

    const existingUser = await c.env.DB
      .prepare(`select id from users where email = ?1 limit 1`)
      .bind(body.email.toLowerCase())
      .first()

    if (existingUser) {
      return c.json(
        {
          ok: false,
          error: 'Ese correo ya fue registrado anteriormente',
        },
        409
      )
    }

    const userId = crypto.randomUUID()
    const profileId = crypto.randomUUID()
    const goalId = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    await c.env.DB.batch([
      c.env.DB
        .prepare(
          `insert into users (id, email, name, created_at)
           values (?1, ?2, ?3, ?4)`
        )
        .bind(userId, body.email.toLowerCase(), body.name, createdAt),

      c.env.DB
        .prepare(
          `insert into athlete_profiles (
            id, user_id, experience_level, weekly_days_available,
            current_weekly_volume, preferred_goal_type, notes, created_at
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
        )
        .bind(
          profileId,
          userId,
          body.level,
          body.daysPerWeek,
          body.currentVolumeKm,
          body.goal,
          body.notes ?? '',
          createdAt
        ),

      c.env.DB
        .prepare(
          `insert into goals (
            id, user_id, goal_type, target_distance, target_event_name,
            target_event_date, status, created_at
          ) values (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7)`
        )
        .bind(
          goalId,
          userId,
          body.goal,
          body.distance,
          body.eventName ?? null,
          body.eventDate ?? null,
          createdAt
        ),
    ])

    return c.json({
      ok: true,
      userId,
      profileId,
      goalId,
      message: 'Onboarding saved',
    })
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      500
    )
  }
})