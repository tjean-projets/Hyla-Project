-- Ajoute le statut 'en_financement' à l'enum deal_status
-- Permet d'isoler dans le Kanban Ventes les deals signés en attente de validation bancaire
-- (financement en cours). Action côté UI : "Reporter au mois prochain" pour décaler la
-- commission au mois où le financement est confirmé.

ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'en_financement';
